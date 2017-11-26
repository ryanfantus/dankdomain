/*****************************************************************************\
 *  Dank Domain: the return of Hack & Slash                                  *
 *  DUNGEON authored by: Robert Hurst <theflyingape@gmail.com>               *
\*****************************************************************************/

import fs = require('fs')

import $ = require('../common')
import Battle = require('../battle')
import xvt = require('xvt')
import { resend } from '../email';
import { fail } from 'assert';

module Dungeon
{
	const monsters: monster = require('../etc/dungeon.json')
	let party: active[]

	interface dungeon {
		rooms: [ room[] ]	//	7-10
		map: number			//	0=none, 1=map, 2=marauder
		moves: number
		width: number		//	7-13
	}
	interface room {
		map: boolean		//	explored?
		occupant: number	//	0=none, 1=trapdoor, 2=deeper dungeon, 3=well, 4=wheel, 5=thief, 6=cleric, 7=wizard
		type: number		//	0=Emp, 1=N-S, 2=W-E, 3=Cav
		giftItem?: string	//	potion, poison, magic, xmagic, chest, map, armor, weapon, marauder
		giftValue?: number
		giftID?: boolean	//	undefined, or identified?
		monster?: active[]
	}

	let fini: Function
	let tl: number

	let looked: boolean
	let pause: boolean
	let refresh: boolean

	let paper: string[]
	let dot = xvt.Empty[$.player.emulation]
	let dd = new Array(10)
	let deep: number
	let DL: dungeon
	let ROOM: room
	let Z: number
	let Y: number
	let X: number

    //  £
    export const Cleric = {
        VT: '\x1B(0\x7D\x1B(B',
        PC: '\x9C',
        XT: '\u00A3',
        dumb: '$'
    }

    //  ±
    export const Teleport = {
        VT: '\x1B(0\x67\x1B(B',
        PC: '\xF1',
        XT: '\u00B1',
        dumb: '%'
    }

	let dungeon: choices = {
		'N': { description:'orth' },
		'S': { description:'outh' },
		'E': { description:'ast' },
		'W': { description:'est' },
		'M': { description:'' },
		'C': { description:'' },
		'P': { description:'' },
		'Y': { description:'' }
	}

export function DeepDank(start: number, cb: Function) {
	looked = false
	pause = false

	party = []
	party.push($.online)
	tl = Math.round((xvt.sessionAllowed - ((new Date().getTime() - xvt.sessionStart.getTime()) / 1000)) / 60)

	deep = 0
	Z = start < 0 ? 0 : start > 99 ? 99 : start
	fini = cb

	generateLevel()
	menu()
}

//	check player status: level up, changed, dead
//	did player cast teleport?
//	did player enter a room?
//	does last output(s) need a pause?
//	is a redraw needed?
//	is a monster spawning needed?
//	position Hero and get user command
export function menu(suppress = false) {
//	check player status: level up, changed, dead
	if ($.player.level + 1 < $.sysop.level) 
		if ($.checkXP($.online, menu)) {
			pause = true
			return
		}
	if ($.online.altered) $.saveUser($.player)
	if ($.reason) xvt.hangup()

//	did player cast teleport?
	if (!Battle.retreat && Battle.teleported) {
		Battle.teleported = false
		teleport()
		return
	}

//	did player enter a new room (or complete what's in it)?
	if (!looked)
		if (!(looked = doMove()))
			return

//	does last output(s) need a pause?
	if (pause) {
		pause = false
		xvt.app.form = {
			'pause': { cb:menu, pause:true }
		}
		xvt.app.focus = 'pause'
		return
	}

//	is a redraw needed?
	if (refresh) {
		drawLevel()
		refresh = false
	}

//	is a monster spawning needed?
	let x = $.dice(DL.width) - 1, y = $.dice(DL.rooms.length) - 1
	ROOM = DL.rooms[y][x]
	if ($.dice((ROOM.type == 0 ? 2 : ROOM.type == 3 ? 1 : 4)
		* $.online.cha / 5 - DL.moves / 10) == 1) {
		xvt.plot($.player.rows, 1)
		xvt.out(xvt.reset, '\n', xvt.faint, ['Your skin crawls'
			, 'Your pulse quickens', 'You feel paranoid', 'Your grip tightens'
			, 'You stand ready'][$.dice(5) - 1], ' when you hear a')
		switch ($.dice(5)) {
			case 1:
				$.sound('creak')
				xvt.out('n eerie, creaking noise')
				break
			case 2:
				$.sound('thunder')
				xvt.out(' clap of thunder')
				break
			case 3:
				$.sound('ghostly')
				xvt.out(' ghostly whisper')
				break
			case 4:
				$.sound('growl')
				xvt.out(' beast growl')
				break
			case 5:
				$.sound('laugh')
				xvt.out(' maniacal laugh')
				break
		}
		if (Math.abs(Y - y) < 3 && Math.abs(X - x) < 3)
			xvt.out(' nearby!\n')
		else if (Math.abs(Y - y) < 6 && Math.abs(X - x) < 6)
			xvt.out(' off in the distance.\n')
		else
			xvt.out(' as a faint echo.\n')

		if (putMonster(y, x)) {
			if (DL.map > 1)
				drawRoom(y, x)
			xvt.plot($.player.rows, 1)
			if (ROOM.occupant == 6) {
				$.sound('agony', 8)
				xvt.out(xvt.reset, xvt.bright, xvt.yellow, 'You hear a dying cry of agony!!\n', xvt.reset)
				xvt.waste(800)
				ROOM.occupant = 0
				if (DL.map > 1) {
					drawRoom(y, x)
					xvt.waste(800)
				}
			}
			//	look who came for dinner?
			if (y == Y && x == X) {
				looked = false
				menu()
				return
			}
		}
	}

//	position Hero and get user command
	$.action('dungeon')
	x = $.online.cha * $.online.int / 10 + $.online.dex / (deep + 1)
	if ($.player.level / 9 - deep > $.Security.name[$.player.security].protection + 1)
		x /= $.player.level
	if ($.dice(x + deep) == 1) {
		switch ($.dice(5)) {
			case 1:
				xvt.out(xvt.faint, 'A bat flies by and soils your ', xvt.normal)
				$.sound('splat', 4)
				$.player.toAC -= $.dice(deep)
				xvt.out($.player.armor, $.buff($.player.toAC, $.online.toAC))
				break
			case 2:
				xvt.out(xvt.blue, 'A drop of acid water lands on your ')
				$.sound('drop', 4)
				$.player.toWC -= $.dice(deep)
				xvt.out($.player.weapon, $.buff($.player.toWC, $.online.toWC))
				break
			case 3:
				xvt.out(xvt.yellow, 'You trip on the rocky surface and hurt yourself.')
				$.sound('hurt', 5)
				$.online.hp -= $.dice(Z)
				if ($.online.hp < 1) {
					$.reason = 'fell down'
					xvt.hangup()
				}
				break
			case 4:
				xvt.out(xvt.bright, xvt.red, 'You are attacked by a swarm of bees.')
				$.sound('oof', 5)
				for (x = 0, y = $.dice(Z); x < y; x++)
					$.online.hp -= $.dice(Z)
				if ($.online.hp < 1) {
					$.reason = 'killer bees'
					xvt.hangup()
				}
				break
			case 5:
				$.music('.')
				xvt.out(xvt.bright, xvt.white, 'A bolt of lightning strikes you.')
				$.sound('boom', 10)
				$.player.toAC -= $.dice($.online.armor.ac >>1)
				$.online.toAC -= $.dice($.online.armor.ac >>1)
				$.player.toWC -= $.dice($.online.weapon.wc >>1)
				$.online.toWC -= $.dice($.online.weapon.wc >>1)
				$.online.hp -= $.dice($.player.hp >>1)
				if ($.online.hp < 1) {
					$.reason = 'struck by lightning'
					xvt.hangup()
				}
				break
		}
		xvt.out(xvt.reset, '\n')
	}
	if ($.online.weapon.wc + $.online.toWC + $.player.toWC < 0) {
		xvt.out(`Your ${$.player.weapon} is damaged beyond repair; you toss it aside.\n`)
		$.Weapon.equip($.online, $.Weapon.merchant[0])
	}
	if ($.online.armor.ac + $.online.toAC + $.player.toAC < 0) {
		xvt.out(`Your ${$.player.armor} is damaged beyond repair; you toss it aside.\n`)
		$.Armor.equip($.online, $.Armor.merchant[0])
	}
	drawHero()

	//	user input
	xvt.app.form = {
        'command': { cb:command, enter:'?', eol:false }
    }
	if (suppress)
		xvt.app.form['command'].prompt = ':'
	else {
		xvt.app.form['command'].prompt = ''
		if ($.player.magic && $.player.spells.length)
			xvt.app.form['command'].prompt += xvt.attr(
				$.bracket('C', false), xvt.cyan, 'ast, '
			)
		if ($.player.poison && $.player.poisons.length)
			xvt.app.form['command'].prompt += xvt.attr(
				$.bracket('P', false), xvt.cyan, 'oison, '
			)
		if (Y > 0 && DL.rooms[Y][X].type !== 2)
			if (DL.rooms[Y - 1][X].type !== 2)
				xvt.app.form['command'].prompt += xvt.attr(
					$.bracket('N', false), xvt.cyan, 'orth, '
				)
		if (Y < DL.rooms.length - 1 && DL.rooms[Y][X].type !== 2)
			if (DL.rooms[Y + 1][X].type !== 2)
				xvt.app.form['command'].prompt += xvt.attr(
					$.bracket('S', false), xvt.cyan, 'outh, ',
				)
		if (X < DL.width - 1 && DL.rooms[Y][X].type !== 1)
			if (DL.rooms[Y][X + 1].type !== 1)
				xvt.app.form['command'].prompt += xvt.attr(
					$.bracket('E', false), xvt.cyan, 'ast, ',
				)
		if (X > 0 && DL.rooms[Y][X].type !== 1)
			if (DL.rooms[Y][X - 1].type !== 1)
				xvt.app.form['command'].prompt += xvt.attr(
					$.bracket('W', false), xvt.cyan, 'est, ',
				)

		xvt.app.form['command'].prompt += xvt.attr(
			$.bracket('Y', false), xvt.cyan, 'our status: '
		)
	}
	xvt.app.focus = 'command'
}

function command() {
	let suppress = $.player.expert
	let choice = xvt.entry.toUpperCase()
	if (/\[.*\]/.test(xvt.terminator)) {
		choice = 'NSEW'['UDRL'.indexOf(xvt.terminator[1])]
		xvt.out(choice)
	}
    if (xvt.validator.isNotEmpty(dungeon[choice])) {
		xvt.out(dungeon[choice].description)
		DL.moves++
	}
    else {
        xvt.beep()
        suppress = false
	}
	xvt.out('\n')

    switch (choice) {
	case 'M':	//	#tbt
		if ($.access.sysop) DL.map = 2
		refresh = true
		break

	case 'C':
		Battle.retreat = false
		Battle.cast($.online, menu)
		return

	case 'P':
		Battle.poison($.online, menu)
		return

	case 'Y':
		xvt.out('\n')
		Battle.yourstats()
		break

	case 'N':
		if (Y > 0 && DL.rooms[Y][X].type !== 2)
			if (DL.rooms[Y - 1][X].type !== 2) {
				drawRoom(Y, X)
				Y--
				looked = false
				break
			}
		oof('north')
		break

	case 'S':
		if (Y < DL.rooms.length - 1 && DL.rooms[Y][X].type !== 2)
			if (DL.rooms[Y + 1][X].type !== 2) {
				drawRoom(Y, X)
				Y++
				looked = false
				break
			}
		oof('south')
		break

	case 'E':
		if (X < DL.width - 1 && DL.rooms[Y][X].type !== 1)
			if (DL.rooms[Y][X + 1].type !== 1) {
				drawRoom(Y, X)
				X++
				looked = false
				break
			}
		oof('east')
		break

	case 'W':
		if (X > 0 && DL.rooms[Y][X].type !== 1)
			if (DL.rooms[Y][X - 1].type !== 1) {
				drawRoom(Y, X)
				X--
				looked = false
				break
			}
		oof('west')
		break
	}

	menu(suppress)
}

function oof(wall:string) {
	$.sound('wall')
	xvt.out(xvt.bright, xvt.yellow, 'Oof!  There is a wall to the ', wall, '.\n', xvt.reset)
	xvt.waste(600)
	if (($.online.hp -= $.dice(deep + Z + 1)) < 1) {
		xvt.out('\nYou take too many hits and die!\n\n')
		xvt.waste(500)
		if (Battle.retreat)
			$.reason = 'running into a wall'
		else
			$.reason = 'banged head against a wall'
		xvt.hangup()
	}
}

//	look around, return whether done or not
function doMove(): boolean {
	ROOM = DL.rooms[Y][X]
	if ($.online.int > 49)
		ROOM.map = true

	//	nothing special in here, done
	if (!ROOM.occupant && !ROOM.monster.length && !ROOM.giftItem)
		return true

	xvt.plot($.player.rows, 1)
	xvt.out(xvt.reset, '\n')
	if (looked) return true

	//	monsters?
	if (ROOM.monster.length) {
		xvt.out(`\x1B[1;${$.player.rows}r`)
		xvt.plot($.player.rows, 1)
		refresh = true

		if (ROOM.monster.length == 1) {
			xvt.out('There\'s something lurking in here . . . \n')
			let img = 'dungeon/' + ROOM.monster[0].user.handle
			try {
				fs.accessSync('images/' + img + '.jpg', fs.constants.F_OK)
				$.profile({ jpg:img })
			} catch(e) {
				$.profile({ png:'monster/' + ROOM.monster[0].user.pc.toLowerCase() })
			}
		}
		else {
			xvt.out('There\'s a party waiting for '
				, ['you', 'the main course', 'the entertainment', 'meat', 'a good chew'][$.dice(5) - 1]
				, ' . . . \n')
			let m = {}
			for (let i = 0; i < ROOM.monster.length; i++)
				m['mob' + (i+1)] = 'monster/' + ROOM.monster[i].user.pc.toLowerCase()
			$.profile(m)
		}
		xvt.waste(1000)

		for (let n = 0; n < ROOM.monster.length; n++) {
			$.cat('dungeon/' + ROOM.monster[n].user.handle)
			xvt.out(xvt.reset, '\nIt\'s', $.an(ROOM.monster[n].user.handle), '!')
			xvt.waste(600)
			xvt.out('  And it doesn\'t look friendly.\n')
			xvt.waste(400)

			if (isNaN(+ROOM.monster[n].user.weapon)) xvt.out('\n', $.who(ROOM.monster[n], 'He'), $.Weapon.wearing(ROOM.monster[n]), '.\n')
			if (isNaN(+ROOM.monster[n].user.armor)) xvt.out('\n', $.who(ROOM.monster[n], 'He'), $.Armor.wearing(ROOM.monster[n]), '.\n')
		}

		Battle.engage('Dungeon', party, ROOM.monster, doSpoils)
		return false
	}

	//	npc?
	switch (ROOM.occupant) {
		case 1:
			if ($.dice(100 - Z) > 1) {
				xvt.out('You have stepped onto a trapdoor!\n\n')
				xvt.waste(300)
				let u = ($.dice(120) < $.online.dex)
				for (let m = party.length - 1; m > 0; m--) {
					if ($.dice(120) < party[m].dex) {
						xvt.out(xvt.reset, party[m].user.handle, ' manages to catch the edge and stop',
							$.who(party[m], 'him'), '\x08self from falling.\n')
					}
					else {
						xvt.out(xvt.bright, xvt.yellow,
							party[m].user.handle, ' falls down a level!\n')
						if (u) party.splice(m, 1)
					}
					xvt.waste(300)
				}
				if (u) {
					xvt.out(xvt.reset, 'You manage to catch the edge and stop yourself from falling.\n')
					ROOM.occupant = 0
				}
				else {
					xvt.out(xvt.bright, xvt.yellow, 'You fall down a level!\n', xvt.reset)
					xvt.waste(600)
					if ($.dice(100 + deep * Z / 10) > $.online.dex) {
						if ($.dice($.online.cha / 10 + deep) <= (deep + 1))
							$.player.toWC -= $.dice(deep / 3)
						$.online.toWC -= $.dice($.online.weapon.wc / 10 + 1)
						xvt.out(`Your ${$.player.weapon} is damaged from the fall!\n`)
					}
					if ($.dice(100 + deep * Z / 10) > $.online.dex) {
						if ($.dice($.online.cha / 10 + deep) <= (deep + 1))
							$.player.toAC -= $.dice(deep / 3)
						$.online.toAC -= $.dice($.online.armor.ac / 10 + 1)
						xvt.out(`Your ${$.player.armor} is damaged from the fall!\n`)
					}
					Z++
					generateLevel()
					pause = true
					return true
				}
			}
			else {
				xvt.out(xvt.bright, xvt.cyan, 'A fairie flies by.\n')
				ROOM.occupant = 0
			}
			break

		case 2:
			xvt.out(xvt.bright, xvt.blue, 'You\'ve found a portal to a deep, dank dungeon.')
			xvt.app.form = {
				'deep': { cb: () => {
					ROOM.occupant = 0
					xvt.out('\n')
					if (/Y/i.test(xvt.entry)) {
						xvt.out(xvt.bright, 'You vanish into the other dungeon...')
						$.sound('teleport', 8)
						deep++
						generateLevel()
					}
					menu()
				}, prompt:'Descend even deeper (Y/N)? ', cancel:'N', enter:'Y', eol:false, match:/Y|N/i }
			}
			xvt.app.focus = 'deep'
			return false

		case 3:
			xvt.out(xvt.magenta, 'You have found a legendary Wishing Well.\n\n')
			pause = true
			break

		case 4:
			xvt.out(xvt.magenta, 'You have found a Mystical Wheel of Life.\n\n')
			pause = true
			break

		case 5:
			xvt.out(xvt.cyan, xvt.faint, 'There is a thief in this '
				, ['chamber', 'hallway', 'corridor', 'cavern'][ROOM.type]
				, '! ', xvt.white)
			xvt.waste(600)
			ROOM.occupant = 0
			let x = $.dice(DL.width) - 1, y = $.dice(DL.rooms.length) - 1
			ROOM = DL.rooms[y][x]
			if (ROOM.occupant || $.dice(Z * (($.player.steal >>1) + 1) + 1) > Z + deep) {
				if (!ROOM.occupant) {
					ROOM.occupant = 5
					xvt.out([
						'He silently ignores you',
						'He recognizes your skill and winks',
						'He slaps your back, but your wallet remains',
						'He offers you a drink, and you accept',
						'"I\'ll be seeing you again", as he leaves'
						][$.dice(5) - 1], '.\n')
				}
				else {
					xvt.out(xvt.magenta, 'He teleports away!\n', xvt.reset)
					$.sound('teleport', 8)
				}
			}
			else {
				ROOM.occupant = 5
				if (DL.map > 1)
					xvt.out('You expect nothing less from the coward.')
				else
					xvt.out(xvt.bright, xvt.white, 'He surprises you!')
				xvt.waste(400)
				xvt.out(xvt.reset, '\nAs he passes by, he steals your ')
				x = $.online.cha + deep + 1
				if ($.player.level / 9 - deep > $.Security.name[$.player.security].protection + 1)
					x = Math.trunc(x / $.player.level)
				if ($.online.weapon.wc && $.dice(x) == 1) {
					xvt.out($.player.weapon, $.buff($.player.toWC, $.online.toWC))
					$.Weapon.equip($.online, $.Weapon.merchant[0])
				}
				else if (DL.map && $.dice($.online.cha / 10 + deep + 1) - 1 <= (deep >>1)) {
					xvt.out('map')
					DL.map = 0
					refresh = true
				}
				else if ($.player.magic < 3 && $.player.spells.length && $.dice($.online.cha / 10 + deep + 1) - 1 <= (deep >>1)) {
					y = $.player.spells[$.dice($.player.spells.length) - 1]
					xvt.out(['wand', 'scroll'][$.player.magic - 1], ' for ', Object.keys($.Magic.spells)[y - 1])
					$.Magic.remove($.player.spells, y)
				}
				else if ($.player.poisons.length && $.dice($.online.cha / 10 + deep + 1) - 1 <= (deep >>1)) {
					y = $.player.poisons[$.dice($.player.poisons.length) - 1]
					xvt.out('vial of ', Object.keys($.Poison.vials)[y - 1])
					$.Poison.remove($.player.poisons, y)
				}
				else if ($.player.coin.value) {
					let pouch = $.player.coin.amount.split(',')
					x = $.dice(pouch.length) - 1
					y = 'csgp'.indexOf(pouch[x].substr(-1))
					xvt.out('pouch of ', ['copper','silver','gold','platinum'][y], ' pieces')
					$.player.coin.value -= new $.coins(pouch[x]).value
				}
				else
					xvt.out('Reese\'s pieces')
				xvt.out(xvt.reset, '!\n')
				xvt.waste(600)
				pause = true
			}
			break

		case 6:
			let cost = new $.coins(Math.trunc($.money(Z) / 6 / $.player.hp * ($.player.hp - $.online.hp)))
			if (cost.value < 1) cost.value = 1
			cost.value *= (deep + 1)
			if ($.online.cha > 98)
				cost.value = 0
			cost = new $.coins(cost.carry(1, true))

			if ($.online.hp >= $.player.hp || cost.value > $.player.coin.value) {
				xvt.out('"I will pray for you."\n')
				break
			}

			$.cat('dungeon/cleric')
			xvt.out(xvt.yellow, 'There is an old cleric in this room.\n', xvt.reset)
			xvt.out('He says, "I can heal all your wounds for '
				, cost.value ? cost.carry() : `you, ${$.player.gender == 'F' ? 'sister' : 'brother'}`
				, '."')
			if (cost.value) {
				xvt.app.form = {
				'pay': { cb: () => {
						xvt.out('\n\n')
						if (/Y/i.test(xvt.entry)) {
							$.player.coin.value -= cost.value
							$.sound('shimmer', 4)
							xvt.out('He casts a Cure spell on you.')
							$.online.hp = $.player.hp
						}
						else {
							ROOM.occupant = 0
							xvt.out(xvt.magenta, 'He teleports away!\n', xvt.reset)
							$.sound('teleport', 8)
						}
						menu()
					}, prompt:'Will you pay (Y/N)? ', cancel:'N', enter:'Y', eol:false, match:/Y|N/i }
				}
				xvt.app.focus = 'pay'
				return false
			}
			else {
				$.sound('shimmer', 4)
				xvt.out('\nHe casts a Cure spell on you.\n')
				$.online.hp = $.player.hp
			}
			break

		case 7:
			xvt.out(`\x1B[1;${$.player.rows}r`)
			xvt.plot($.player.rows, 1)
			refresh = true
			xvt.out(xvt.magenta, 'You encounter a wizard in this room.\n\n')
			teleport()
			return false
	}

	//	items?
	switch (ROOM.giftItem) {
		case 'armor':
			break

		case 'chest':
			let gold = new $.coins($.money(Z))
			gold.value += $.worth(new $.coins($.online.weapon.value).value, $.online.cha)
			gold.value += $.worth(new $.coins($.online.armor.value).value, $.online.cha)
			gold.value *= ROOM.giftValue
			gold = new $.coins(gold.carry(1, true))
			if (gold.value) {
				xvt.out(xvt.bright, xvt.yellow, 'You find a treasure chest holding '
					, gold.carry(), '!\n', xvt.reset)
				$.sound('max')
			}
			else
				xvt.out(xvt.yellow, 'You find an empty, treasure chest.\n', xvt.reset)
			$.player.coin.value += gold.value
			ROOM.giftItem = ''
			break

		case 'magic':
			if (!$.Magic.have($.player.spells, ROOM.giftValue)) {
				xvt.out(xvt.bright, xvt.yellow, 'You find a '
					, $.Magic.merchant[ROOM.giftValue - 1]
					, ' ', $.player.magic == 1 ? 'wand' : 'scroll'
					, '!\n', xvt.reset)
				$.Magic.add($.player.spells, ROOM.giftValue)
				ROOM.giftItem = ''
			}
			break

		case 'map':
			xvt.out(xvt.bright, xvt.yellow, 'You find a magic map!\n', xvt.reset)
			DL.map = 3
			pause = true
			refresh = true
			ROOM.giftItem = ''
			break

		case 'poison':
			if (!$.Poison.have($.player.poisons, ROOM.giftValue)) {
				xvt.out(xvt.bright, xvt.yellow, 'You find a vial of '
					, $.Poison.merchant[ROOM.giftValue - 1], '!\n', xvt.reset)
				$.Poison.add($.player.poisons, ROOM.giftValue)
				ROOM.giftItem = ''
			}
			break

		case 'potion':
			$.sound('bubbles')
			xvt.out(xvt.bright, xvt.cyan, 'On the ground, you find a ',
				['bottle containing', 'flask of some', 'vial holding'][$.dice(3) - 1], ' ',
				[ 'bubbling', 'clear', 'dark', 'sparkling', 'tainted'][$.dice(5) - 1], ' ',
				[ 'amber', 'blue', 'crimson', 'green', 'purple'][$.dice(5) - 1], ' ',
				'potion.')

			if ($.dice(100) + deep < 50 + ($.online.int >>1)) {
				xvt.app.form = {
					'quaff': { cb: () => {
						xvt.out('\n\n')
						if (/N/i.test(xvt.entry)) {
							menu()
							return
						}
						if (/Y/i.test(xvt.entry)) {
							xvt.out(xvt.bright)
							quaff(ROOM.giftValue)
						}
						else if (/T/i.test(xvt.entry)) {
							xvt.out(xvt.faint)
							quaff(ROOM.giftValue, false)
						}
						ROOM.giftItem = ''
						menu()
					}, prompt:'Will you drink it (Yes/No/Toss)? ', cancel:'N', enter:'Y', eol:false, match:/Y|N|T/i }
				}
				xvt.app.focus = 'quaff'
				return false
			}
			else {
				xvt.waste(600)
				xvt.out('\nYou quaff it without hesitation.\n')
				xvt.waste(600)
				quaff(ROOM.giftValue)
			}
			break

		case 'weapon':
			break

		case 'xmagic':
			if (!$.Magic.have($.player.spells, ROOM.giftValue)) {
				xvt.out(xvt.bright, xvt.yellow, 'You find a '
					, $.Magic.special[ROOM.giftValue - $.Magic.merchant.length]
					, ' ', $.player.magic == 1 ? 'wand' : 'scroll'
					, '!\n', xvt.reset)
				$.Magic.add($.player.spells, ROOM.giftValue)
				ROOM.giftItem = ''
			}
			break
	}

	return true
}

export function doSpoils() {
	if ($.reason) xvt.hangup()
	pause = false

	//	remove any dead carcass, displace teleported creatures
	for (let n = ROOM.monster.length - 1; n >= 0; n--)
		if (ROOM.monster[n].hp < 1) {
			if (ROOM.monster[n].hp < 0) {
				let mon = <active>{ user:{id:''} }
				Object.assign(mon, ROOM.monster[n])
				let y = $.dice(DL.rooms.length) - 1
				let x = $.dice(DL.width) - 1
				mon.hp = mon.user.hp >>3
				DL.rooms[y][x].monster.push(mon)
			}
			ROOM.monster.splice(n, 1)
			pause = true
		}

	if (!ROOM.monster.length) {
		if (DL.map < 2 && $.dice((15 - $.online.cha / 10) >>1) == 1) {
			let m = ($.dice(Z / 33 + 2) > 1 ? 1 : 2)
			if (DL.map < m) {
				DL.map = m
				xvt.out('\n', xvt.bright, xvt.yellow
					, 'You find '
					, m == 1 ? 'a' : 'Marauder\'s'
					, ' map!\n', xvt.reset)
				pause = true
			}
		}
	}

	let d = ['N','S','E','W']
	while (Battle.retreat) {
		xvt.out(xvt.bright, xvt.red, 'You frantically look to escape . . . ')
		xvt.waste(400)

		let i = $.dice(d.length) - 1
		switch (d[i]) {
			case 'N':
				if (Y > 0 && DL.rooms[Y][X].type !== 2)
					if (DL.rooms[Y - 1][X].type !== 2) {
						Battle.retreat = false
						Y--
						looked = false
						break
					}
				oof('north')
				break

			case 'S':
				if (Y < DL.rooms.length - 1 && DL.rooms[Y][X].type !== 2)
					if (DL.rooms[Y + 1][X].type !== 2) {
						Battle.retreat = false
						Y++
						looked = false
						break
					}
				oof('south')
				break

			case 'E':
				if (X < DL.width - 1 && DL.rooms[Y][X].type !== 1)
					if (DL.rooms[Y][X + 1].type !== 1) {
						Battle.retreat = false
						X++
						looked = false
						break
					}
				oof('east')
				break

			case 'W':
				if (X > 0 && DL.rooms[Y][X].type !== 1)
					if (DL.rooms[Y][X - 1].type !== 1) {
						Battle.retreat = false
						X--
						looked = false
						break
					}
				oof('west')
				break
		}
		d.splice(i, 1)
		pause = true
	}

	if (Battle.teleported) {
		Battle.teleported = false
		Y = $.dice(DL.rooms.length) - 1
		X = $.dice(DL.width) - 1
		looked = false
	}

	menu()
}

function drawHero() {
	ROOM = DL.rooms[Y][X]
	drawRoom(Y, X)
	xvt.plot(Y * 2 + 2, X * 6 + 2)
	xvt.out(xvt.reset, xvt.reverse, '-YOU-', xvt.reset)
	xvt.plot($.player.rows, 1)
}

function drawLevel() {
	let y:number, x:number
	if ($.player.emulation === 'XT') {
		xvt.plot($.player.rows, 1)
		for (y = 0; y < $.player.rows; y++)
			xvt.out('\n')
	}
	xvt.out(xvt.reset, xvt.clear)

	if (DL.map) {
		for (y = 0; y < paper.length; y++) {
			if (y % 2) {
				for (x = 0; x < DL.width; x++) {
					if ($.player.emulation === 'VT') xvt.out('\x1B(0', xvt.faint, paper[y].substr(6 * x, 1), '\x1B(B')
					else xvt.out(xvt.reset, xvt.bright, xvt.black, paper[y].substr(6 * x, 1))
					xvt.out(xvt.reset)

					let r = y >>1
					let icon = null
					let o = '     '
					if (DL.rooms[r][x].map)
						o = xvt.attr(xvt.reset, DL.rooms[r][x].type == 0 ? xvt.bright
							: DL.rooms[r][x].type == 3 ? xvt.faint
							: xvt.normal, `  ${dot}  `)

					if (DL.map > 1 || (DL.rooms[r][x].map
						&& Math.abs(Y - r) < Math.trunc($.online.int / 20) && Math.abs(X - x) < Math.trunc($.online.int / 20))) {
						if (DL.rooms[r][x].monster.length) {
							icon = xvt.attr(DL.rooms[r][x].occupant || DL.rooms[r][x].giftItem ? xvt.green : xvt.red, 
								DL.rooms[r][x].monster.length > 1 ? 'Mob' : 'Mon', xvt.reset)
							o = ` ${icon} `
						}
						//	0=none, 1=trapdoor, 2=deeper dungeon, 3=well, 4=wheel, 5=thief, 6=cleric, 7=wizard
						switch (DL.rooms[r][x].occupant) {
							case 0:
								break

							case 1:
								if (!icon && DL.map > 1)
									o = xvt.attr(xvt.reset, xvt.bright, xvt.blink, xvt.cyan, '  ?  ', xvt.reset)
								break

							case 2:
								if (!icon) icon = xvt.attr('v', xvt.bright, xvt.blink, 'V', xvt.noblink, xvt.normal, 'v')
								o = xvt.attr(xvt.faint, xvt.blue, 'v', xvt.normal, icon, xvt.faint, xvt.blue, 'v')
								break

							case 3:
								if (!icon && DL.map > 2)
									o = xvt.attr(xvt.reset, xvt.bright, xvt.blink, xvt.blue, '  *  ', xvt.reset)
								break

							case 4:
								if (!icon && DL.map > 2)
									o = xvt.attr(xvt.reset, xvt.bright, xvt.blink, xvt.green, '  @  ', xvt.reset)
								break

							case 5:
								if (!icon && ($.player.steal == 4 || DL.map > 1))
									o = xvt.attr(xvt.faint, '  &  ', xvt.normal)
								break

							case 6:
								if (!icon) icon = xvt.attr(xvt.uline, '_', xvt.bright, Cleric[$.player.emulation], xvt.normal, '_', xvt.nouline)
								o = xvt.attr(xvt.faint, xvt.yellow, ':', xvt.normal, icon, xvt.faint, xvt.yellow, ':')
								break

							case 7:
								if (!icon) icon = xvt.attr(xvt.uline, '_', xvt.bright, Teleport[$.player.emulation], xvt.normal, '_', xvt.nouline)
								o = xvt.attr(xvt.faint, xvt.magenta, '<', xvt.normal, icon, xvt.faint, xvt.magenta, '>')
								break
						}
					}
					xvt.out(o)
				}
				if ($.player.emulation === 'VT') xvt.out('\x1B(0', xvt.faint, paper[y].substr(-1), '\x1B(B')
				else xvt.out(xvt.reset, xvt.bright, xvt.black, paper[y].substr(-1))
			}
			else {
				if ($.player.emulation === 'VT') xvt.out('\x1B(0', xvt.faint, paper[y], '\x1B(B')
				else xvt.out(xvt.reset, xvt.bright, xvt.black, paper[y])
			}
			xvt.out('\n')
		}
	}
	else {
		for (y = 0; y < DL.rooms.length; y++)
			for (x = 0; x < DL.width; x++)
				if (DL.rooms[y][x].map)
					drawRoom(y, x)
	}

	xvt.out(`\x1B[${paper.length + 1};${$.player.rows}r`)
	xvt.plot(paper.length + 1, 1)
/*	for (y = 0; y < DL.rooms.length; y++)
		for (x = 0; x < DL.width; x++)
			if (DL.rooms[y][x].giftItem)
				console.log('[', y, ',', x, ']', DL.rooms[y][x].giftItem, DL.rooms[y][x].giftValue)
*/
}

function drawRoom(r:number, c:number) {
	ROOM = DL.rooms[r][c]
	let row = r * 2, col = c * 6
	if (!DL.map) {
		xvt.plot(row + 1, col + 1)
		if ($.player.emulation === 'VT') xvt.out('\x1B(0', xvt.faint, paper[row].substr(col, 7), '\x1B(B')
		else xvt.out(xvt.reset, xvt.bright, xvt.black, paper[row].substr(col, 7))
	}

	row++
	xvt.plot(row + 1, col + 1)
	if ($.player.emulation === 'VT') xvt.out('\x1B(0', xvt.faint, paper[row].substr(col, 1), '\x1B(B')
	else xvt.out(xvt.reset, xvt.bright, xvt.black, paper[row].substr(col, 1))
	xvt.out(xvt.reset)

	let icon = null
	let o: string

	if (ROOM.map)
		o = xvt.attr(xvt.reset, ROOM.type == 0 ? xvt.bright
			: ROOM.type == 3 ? xvt.faint
			: xvt.normal, `  ${dot}  `)
	else
		o = xvt.attr('     ')

	if (ROOM.monster.length)
		icon = xvt.attr(ROOM.occupant ? xvt.green : xvt.red, ROOM.monster.length > 1 ? 'Mob' : 'Mon', xvt.reset)

	//	0=none, 1=trapdoor, 2=deeper dungeon, 3=well, 4=wheel, 5=thief, 6=cleric, 7=wizard
	switch (ROOM.occupant) {
		case 0:
			if (icon) o = ` ${icon} `
			break

		case 1:
			if (DL.map)
				o = xvt.attr(xvt.reset, xvt.bright, xvt.blink, xvt.cyan, '  ?  ', xvt.reset)
			break

		case 2:
			if (!icon) icon = xvt.attr('v', xvt.bright, xvt.blink, 'V', xvt.noblink, xvt.normal, 'v')
			o = xvt.attr(xvt.faint, xvt.blue, 'v', xvt.normal, icon, xvt.faint, xvt.blue, 'v')
			break

		case 3:
			if (!icon && DL.map > 2)
				o = xvt.attr(xvt.reset, xvt.bright, xvt.blink, xvt.blue, '  *  ', xvt.reset)
			break

		case 4:
			if (!icon && DL.map > 2)
				o = xvt.attr(xvt.reset, xvt.bright, xvt.blink, xvt.green, '  @  ', xvt.reset)
			break

		case 5:
			if (!icon && ($.player.steal == 4 || DL.map == 2))
				o = xvt.attr(xvt.faint, '  &  ', xvt.normal)
			break

		case 6:
			if (!icon) icon = xvt.attr(xvt.uline, '_', xvt.bright, Cleric[$.player.emulation], xvt.normal, '_', xvt.nouline)
			o = xvt.attr(xvt.faint, xvt.yellow, ':', xvt.normal, icon, xvt.faint, xvt.yellow, ':')
			break

		case 7:
			if (!icon) icon = xvt.attr(xvt.uline, '_', xvt.bright, Teleport[$.player.emulation], xvt.normal, '_', xvt.nouline)
			o = xvt.attr(xvt.faint, xvt.magenta, '<', xvt.normal, icon, xvt.faint, xvt.magenta, '>')
			break
	}
	xvt.out(o)

	if ($.player.emulation === 'VT') xvt.out('\x1B(0', xvt.faint, paper[row].substr(col + 6, 1), '\x1B(B')
	else xvt.out(xvt.reset, xvt.bright, xvt.black, paper[row].substr(col + 6, 1))

	if (!DL.map) {
		row++
		xvt.plot(row + 1, col + 1)
		if ($.player.emulation === 'VT') xvt.out('\x1B(0', xvt.faint, paper[row].substr(col, 7), '\x1B(B')
		else xvt.out(xvt.reset, xvt.bright, xvt.black, paper[row].substr(col, 7))
	}
}

function generateLevel() {
	looked = false
	refresh = true

	if (!dd[deep])
		dd[deep] = new Array(100)

	if (dd[deep][Z]) {
		DL = dd[deep][Z]
		renderMap()
		Y = $.dice(DL.rooms.length) - 1
		X = $.dice(DL.width) - 1
		ROOM = DL.rooms[Y][X]
		DL.moves += (Z >>3) + 1
		return
	}

	let y:number, x:number
	let result: boolean
	do {
		let maxRow = 6 + $.dice(Z / 32 + 1)
		while (maxRow < 10 && $.dice($.online.cha / (4 * ($.player.backstab + 1))) == 1)
			maxRow++
		let maxCol = 6 + $.dice(Z / 16 + 1)
		while (maxCol < 13 && $.dice($.online.cha / (4 * ($.player.backstab + 1))) == 1)
			maxCol++

		dd[deep][Z] = <dungeon>{
			rooms: new Array(maxRow),
			map: 0,
			moves: -1,
			width: maxCol
		}

		DL = dd[deep][Z]
		for (y = 0; y < DL.rooms.length; y++) {
			DL.rooms[y] = new Array(DL.width)
			for (x = 0; x < DL.width; x++)
				DL.rooms[y][x] = <room>{ map:true, monster:[], occupant:0, type:0 }
		}

		for (y = 0; y < DL.rooms.length; y++) {
			for (x = 0; x < DL.width; x++) {
				let n:number
				while ((n = (($.dice(4) + $.dice(4)) >>1) - 1) == 3);
				DL.rooms[y][x].type = (n == 0) ? 3 : (n == 1) ? 0 : $.dice(2)
			}
		}

		result = false
		spider(0, 0)
		for (y = 0; y < DL.rooms.length; y++)
			for (x = 0; x < DL.width; x++)
				if (DL.rooms[y][x].map)
					result = true
	} while (result)

	renderMap()
	Y = $.dice(DL.rooms.length) - 1
	X = $.dice(DL.width) - 1
	ROOM = DL.rooms[Y][X]

	//	populate this new floor with monsters, no corridors or hallways
	let n = Math.trunc(DL.rooms.length * DL.width / 6 + $.dice(Z / 11) + (deep >>1) + $.dice(deep >>1))
	while (n)
		if (putMonster())
			n--

	let wow:number = 1

	//	potential bonus(es) for the more experienced adventurer
	if (!$.player.novice) {
		//	gift map
		if ($.dice($.player.immortal) > Z && $.dice($.player.wins) > deep) {
			y = $.dice(DL.rooms.length) - 1
			x = $.dice(DL.width) - 1
			DL.rooms[y][x].giftItem = 'map'
			if (Math.trunc($.dice(100 * (Z + 1)) / (deep + 1)) < (deep + 4))
				wow = DL.rooms.length * DL.width
		}

		//	wishing well
		if ($.dice((110 - Z) / 3 + deep) == 1) {
			for (let i = 0; i < wow; i++) {
				y = $.dice(DL.rooms.length) - 1
				x = $.dice(DL.width) - 1
				DL.rooms[y][x].occupant = 3
			}
			wow = 1
		}

		//	wheel of life
		if ($.dice((110 - Z) / 3 + deep) == 1) {
			for (let i = 0; i < wow; i++) {
				y = $.dice(DL.rooms.length) - 1
				x = $.dice(DL.width) - 1
				DL.rooms[y][x].occupant = 4
			}
			wow = 1
		}

		//	deep dank dungeon portal
		if (deep < 10 && deep < $.player.immortal) {
			y = $.dice(DL.rooms.length) - 1
			x = $.dice(DL.width) - 1
			DL.rooms[y][x].occupant = 2
		}
	}

	//	thief(s) in other spaces
	n = $.dice(deep >>2) + wow
	for (let i = 0; i < n; i++) {
		do {
			y = $.dice(DL.rooms.length) - 1
			x = $.dice(DL.width) - 1
		} while (wow == 0 && DL.rooms[y][x].type == 3)
		DL.rooms[y][x].occupant = 5
		wow--
	}

	//	a cleric in another space
	do {
		y = $.dice(DL.rooms.length) - 1
		x = $.dice(DL.width) - 1
	} while (DL.rooms[y][x].type == 3 || DL.rooms[y][x].monster.length || DL.rooms[y][x].occupant)
	DL.rooms[y][x].occupant = 6

	//	a wizard in another space
	do {
		y = $.dice(DL.rooms.length) - 1
		x = $.dice(DL.width) - 1
	} while (DL.rooms[y][x].type == 3 || DL.rooms[y][x].monster.length || DL.rooms[y][x].occupant)
	DL.rooms[y][x].occupant = 7

	//	set some trapdoors in empty corridors only
	n = (DL.rooms.length * DL.width / 10) >>0
	if ($.dice(100 - Z) > (deep + 1))
		n += $.dice(Z / 16 + 2)
	while (n) {
		y = $.dice(DL.rooms.length) - 1
		x = $.dice(DL.width) - 1
		if (!DL.rooms[y][x].occupant) {
			DL.rooms[y][x].occupant = 1
			n--
		}
	}

	wow = 1

	//	potential bonus(es) for the more experienced adventurer
	if (!$.player.novice && $.dice($.player.immortal) > Z)
		if (Math.trunc($.dice(100 * (Z + 1)) / (deep + 1)) < (deep + 2))
			wow = DL.rooms.length * DL.width

	wow = $.dice(Z / 33) + $.dice(deep / 3) + wow - 2
	for (let i = 0; i < wow; i++) {
		y = $.dice(DL.rooms.length) - 1
		x = $.dice(DL.width) - 1

		if ($.dice(deep + 10) > (deep + 1)) {
			DL.rooms[y][x].giftID = false
			DL.rooms[y][x].giftItem = 'potion'
			n = $.dice(130 - deep)
			for (let i = 0; i < 16 && n > 0; i++) {
				DL.rooms[y][x].giftValue = 15 - i
				n -= i + 1
			}
			if ($.player.magic < 2 && DL.rooms[y][x].giftValue > 2 && DL.rooms[y][x].giftValue < 5)
				DL.rooms[y][x].giftValue >>= 1
			continue
		}
		if ($.dice(deep + 5) > (deep + 1) && $.player.poison) {
			DL.rooms[y][x].giftID = false
			DL.rooms[y][x].giftItem = 'poison'
			DL.rooms[y][x].giftValue =  $.dice($.Poison.merchant.length * Z / 100)
			continue
		}

		if ($.dice(deep + 5) > (deep + 1) && ($.player.magic == 1 || $.player.magic == 2)) {
			DL.rooms[y][x].giftID = false
			DL.rooms[y][x].giftItem = 'magic'
			DL.rooms[y][x].giftValue =  $.dice($.Magic.merchant.length * Z / 100)
			continue
		}

		if ($.dice(deep + 3) > (deep + 1) && ($.player.magic == 1 || $.player.magic == 2)) {
			DL.rooms[y][x].giftID = false
			DL.rooms[y][x].giftItem = 'xmagic'
			DL.rooms[y][x].giftValue =  $.Magic.merchant.length + $.dice($.Magic.special.length)
			continue
		}

		if ($.dice(deep + $.player.magic + 4) > (deep + 1)) {
			DL.rooms[y][x].giftID = false
			DL.rooms[y][x].giftItem = 'chest'
			DL.rooms[y][x].giftValue =  $.dice(10 + deep) - 1
			continue
		}

		if ($.dice(deep * ($.player.magic + 3)) - $.player.magic > (deep + 1)) {
			DL.rooms[y][x].giftID = false
			DL.rooms[y][x].giftItem = 'armor'
			DL.rooms[y][x].giftValue =  $.dice(deep) + 2
			continue
		}

		if ($.dice(deep * ($.player.magic + 2)) - $.player.magic > (deep + 1)) {
			DL.rooms[y][x].giftID = false
			DL.rooms[y][x].giftItem = 'weapon'
			DL.rooms[y][x].giftValue =  $.dice(deep) + 2
			continue
		}
	}

	function spider(r:number, c:number) {
		DL.rooms[r][c].map = false
		if (c + 1 < DL.width)
			if (DL.rooms[r][c + 1].map && DL.rooms[r][c].type !== 1 && DL.rooms[r][c + 1].type !== 1)
				spider(r, c + 1)
		if (r + 1 < DL.rooms.length)
			if (DL.rooms[r + 1][c].map && DL.rooms[r][c].type !== 2 && DL.rooms[r + 1][c].type !== 2)
				spider(r + 1, c)
		if (c > 0)
			if (DL.rooms[r][c - 1].map && DL.rooms[r][c].type !== 1 && DL.rooms[r][c - 1].type !== 1)
				spider(r, c - 1)
		if (r > 0)
			if (DL.rooms[r - 1][c].map && DL.rooms[r][c].type !== 2 && DL.rooms[r - 1][c].type !== 2)
				spider(r - 1, c)
	}

	function renderMap() {
		let min =  Math.round((xvt.sessionAllowed - ((new Date().getTime() - xvt.sessionStart.getTime()) / 1000)) / 60)
		if (tl - min > 4) {
			tl = min
			$.music('dungeon' + $.dice(9))
		}

		const box = xvt.Draw[$.player.emulation]
		let r: number, c: number
		paper = new Array(2 * DL.rooms.length + 1)

		//	draw level borders on an empty sheet of paper
		paper[0] = '\x00' + box[0].repeat(6 * DL.width - 1) + '\x00'
		for (r = 1; r < 2 * DL.rooms.length; r++)
			paper[r] = box[10] + ' '.repeat(6 * DL.width - 1) + box[10]
		paper[paper.length - 1] = '\x00' + box[0].repeat(6 * DL.width - 1) + '\x00'

		//	crawl each room to construct walls
		for (r = 0; r < DL.rooms.length; r++) {
			for (c = 0; c < DL.width; c++) {
				ROOM = DL.rooms[r][c]
				let row = r * 2, col = c * 6

				//	north-south corridor
				if (ROOM.type == 1) {
					if (paper[row][col] == ' ')
						paper[row] = replaceAt(paper[row], col, box[10])
					else
					if (paper[row][col] == box[3])
						paper[row] = replaceAt(paper[row], col, box[6])
					else
					if (paper[row][col] == box[2])
						paper[row] = replaceAt(paper[row], col, box[5])
					else
					if (paper[row][col] == box[1])
						paper[row] = replaceAt(paper[row], col, box[4])
					else
					if (paper[row][col] == box[0])
						paper[row] = replaceAt(paper[row], col, box[
							col > 0 && paper[row][col - 1] == ' ' ? 7
							: paper[row][col + 1] == ' ' ? 9 : 8])

					row++
					paper[row] = replaceAt(paper[row], col, box[10])

					row++
					if (paper[row][col] == ' ')
						paper[row] = replaceAt(paper[row], col, box[10])
					else
					if (paper[row][col] == box[0])
						paper[row] = replaceAt(paper[row], col, box[
							col > 0 && paper[row][col - 1] == ' ' ? 1
							: paper[row][col + 1] == ' ' ? 3 : 2])

					row = r * 2
					col += 6

					if (paper[row][col] == ' ')
						paper[row] = replaceAt(paper[row], col, box[10])
					else
					if (paper[row][col] == box[0])
						paper[row] = replaceAt(paper[row], col, box[
							paper[row][col - 1] == ' ' ? 7
							: paper[row][col + 1] == ' ' ? 9 : 8])
					else
					if (paper[row][col] == box[1])
						paper[row] = replaceAt(paper[row], col, box[4])
					else
					if (paper[row][col] == box[2])
						paper[row] = replaceAt(paper[row], col, box[5])
					else
					if (paper[row][col] == box[3])
						paper[row] = replaceAt(paper[row], col, box[6])

					row++
					paper[row] = replaceAt(paper[row], col, box[10])

					row++
					paper[row] = replaceAt(paper[row], col, box[
						row < 2 * DL.rooms.length ? 10 : 2])
				}

				//	east-west corridor
				if (ROOM.type == 2) {
					if (paper[row][col] == ' ')
						paper[row] = replaceAt(paper[row], col, box[0])
					else
					if (paper[row][col] == box[3])
						paper[row] = replaceAt(paper[row], col, box[2])
					else
					if (paper[row][col] == box[6])
						paper[row] = replaceAt(paper[row], col, box[5])
					else
					if (paper[row][col] == box[9])
						paper[row] = replaceAt(paper[row], col, box[8])
					else
					if (paper[row][col] == box[10])
						paper[row] = replaceAt(paper[row], col, box[
							row > 0 && paper[row - 1][col] == ' ' ? 7
							: paper[row + 1][col] == ' ' ? 1 : 4])

					col++
					paper[row] = replaceAt(paper[row], col, box[0].repeat(5))
					col += 5

					if (paper[row][col] == ' ')
						paper[row] = replaceAt(paper[row], col, box[0])
					else
					if (paper[row][col] == box[1])
						paper[row] = replaceAt(paper[row], col, box[2])
					else
					if (paper[row][col] == box[10])
						paper[row] = replaceAt(paper[row], col, box[
							paper[row + 1][col] == box[10] ? 6 : 3])

					row += 2
					col = c * 6
					if (paper[row][col] == box[10])
						paper[row] = replaceAt(paper[row], col, box[
							col > 0 && paper[row][col - 1] == ' ' ?  1 : 4])
					else
					if (paper[row][col] == ' ')
						paper[row] = replaceAt(paper[row], col, box[0])

					col++
					paper[row] = replaceAt(paper[row], col, box[0].repeat(5))
					col += 5

					if (paper[row][col] == ' ')
						paper[row] = replaceAt(paper[row], col, box[0])
					else
					if (paper[row][col] == box[10])
						paper[row] = replaceAt(paper[row], col, box[
							paper[row + 1][col] == box[10] ? 6 : 3])
				}
			}
		}
		r = 2 * DL.rooms.length
		c = 6 * DL.width
		paper[0] = replaceAt(paper[0], 0, box[7])
		paper[0] = replaceAt(paper[0], c, box[9])
		paper[r] = replaceAt(paper[r], 0, box[1])
		paper[r] = replaceAt(paper[r], c, box[3])

		function replaceAt(target:string, offset:number, data:string): string {
			return target.substr(0, offset) + data + target.substr(offset + data.length)
		}
	}
}

function putMonster(r = -1, c = -1): boolean {
	// attempt to add to a room or cavern only
	if (r < 0 && c < 0) {
		do {
			r = $.dice(DL.rooms.length) - 1
			c = $.dice(DL.width) - 1
		} while (DL.rooms[r][c].type != 0 && DL.rooms[r][c].type != 3)
	}

	//	check for overcrowding
	if (DL.rooms[r][c].monster.length)
		if (DL.rooms[r][c].monster.length > 2 || DL.rooms[r][c].type == 1 || DL.rooms[r][c].type == 2)
			return false

	let i:number = DL.rooms[r][c].monster.length
	let j:number = 0
	let dm:monster
	let level: number = 0
	let m:active

	for (j = 0; j < 4; j++)
		level += $.dice(7)
	switch (level >>2) {
		case 1:
			level = $.dice(Z)
			break
		case 2:
			level = Z - 3 - $.dice(3)
			break
		case 3:
			level = Z - $.dice(3)
			break
		case 4:
			level = Z
			break
		case 5:
			level = Z + $.dice(3)
			break
		case 6:
			level = Z + 3 + $.dice(3)
			break
		case 7:
			level = Z + $.dice(100 - Z)
			break
	}
	level = (level < 1) ? 1 : (level > 99) ? 99 : level
	level = (i == 1) ? (level >>1) + $.dice(level / 2 + 1) : (i == 2) ? $.dice(level + 1) : level
	level = (level < 1) ? 1 : (level > 99) ? 99 : level

	//	add a monster level relative to this floor, including "strays"
	let room = DL.rooms[r][c]
	i = room.monster.push(<active>{ user:{ id: '', sex:'I', level:level } }) - 1
	m = room.monster[i]

	//	pick and generate monster class relative to its level
	j = level + $.dice(7) - 4
	j = j < 0 ? 0 : j >= Object.keys(monsters).length ? Object.keys(monsters).length - 1 : j
	m.user.handle = Object.keys(monsters)[j]
	dm = monsters[m.user.handle]
	$.reroll(m.user, dm.pc ? dm.pc : $.player.pc, level)
	if (dm.weapon)
		m.user.weapon = dm.weapon
	else {
		m.user.weapon = Math.trunc((level + deep - 10) / 100 * ($.Weapon.merchant.length - 1))
		m.user.weapon = (m.user.weapon + $.online.weapon.wc) >>1
		if ($.dice($.player.level / 4 - $.online.cha / 10 + 12) == 1) {
			i = $.online.weapon.wc + $.dice(3) - 2
			i = i < 1 ? 1 : i >= $.Weapon.merchant.length ? $.Weapon.merchant.length - 1 : i
			m.user.weapon = $.Weapon.merchant[i]
		}
	}
	if (dm.armor)
		m.user.armor = dm.armor
	else {
		m.user.armor = Math.trunc((level + deep - 10) / 100 * ($.Armor.merchant.length - 1))
		m.user.armor = (m.user.armor + $.online.armor.ac) >>1
		if ($.dice($.player.level / 3 - $.online.cha / 10 + 12) == 1) {
			i = $.online.armor.ac + $.dice(3) - 2
			i = i < 1 ? 1 : i >= $.Armor.merchant.length ? $.Armor.merchant.length - 1 : i
			m.user.armor = $.Armor.merchant[i]
		}
	}
	m.user.hp >>= 2
	i = 5 - $.dice(deep / 3)
	m.user.sp = Math.trunc(m.user.sp / i)

	m.user.poisons = []
	if (m.user.poison) {
		if (dm.poisons)
			for (let vials in dm.poisons)
				$.Poison.add(m.user.poisons, dm.poisons[vials])
		for (let i = 0; i < Object.keys($.Poison.vials).length; i++) {
			if ($.dice($.player.cha + (i <<3)) == 1) {
				let vial = $.Poison.pick(i)
				if (!$.Poison.have(m.user.poisons, vial))
					$.Poison.add(m.user.poisons, i)
			}
		}
	}

	m.user.spells = []
	if (m.user.magic) {
		if (dm.spells)
			for (let magic in dm.spells)
				$.Magic.add(m.user.spells, dm.spells[magic])
		for (let i = 0; i < Object.keys($.Magic.spells).length; i++) {
			if ($.dice($.player.cha + (i <<3)) == 1) {
				let spell = $.Magic.pick(i)
				if (!$.Magic.have(m.user.spells, spell))
					$.Magic.add(m.user.spells, i)
			}
		}
	}

	$.activate(m)

	m.str = $.PC.ability(m.str, deep>>1)
	m.int = $.PC.ability(m.int, deep>>1)
	m.dex = $.PC.ability(m.dex, deep>>1)
	m.cha = $.PC.ability(m.cha, deep>>1)

	let gold = new $.coins(Math.trunc($.money(level) / 10))
	gold.value += $.worth(new $.coins(m.weapon.value).value, ($.dice($.online.cha) / 5 + 5) >>0)
	gold.value += $.worth(new $.coins(m.armor.value).value, ($.dice($.online.cha) / 5 + 5) >>0)
	gold.value *= $.dice(deep)
	m.user.coin = new $.coins(gold.carry(1, true))

	return true
}

export function teleport() {
	let min =  Math.round((xvt.sessionAllowed - ((new Date().getTime() - xvt.sessionStart.getTime()) / 1000)) / 60)

	xvt.out(xvt.bright, xvt.yellow, 'What do you wish to do?\n', xvt.reset)
	xvt.out($.bracket('U'), 'Teleport up 1 level')
	if (Z < 99) xvt.out($.bracket('D'), 'Teleport down 1 level')
	xvt.out($.bracket('O'), `Teleport out of this ${deep ? 'dank' : ''} dungeon`)
	xvt.out($.bracket('R'), 'Random teleport')
	xvt.out(xvt.cyan, '\n\nTime Left: ', xvt.bright, xvt.white, min.toString(), xvt.normal, xvt.cyan, ' min.', xvt.reset)
	if ($.player.coin.value) xvt.out(xvt.cyan, '    Money: ', $.player.coin.carry())
	if ($.player.level / 9 - deep > $.Security.name[$.player.security].protection + 1)
		xvt.out(xvt.faint, '\nThe feeling of insecurity overwhelms you.', xvt.reset)

	$.action('teleport')
	xvt.app.form = {
		'wizard': { cb:() => {
			xvt.out('\n')
			$.sound('teleport', 8)
			switch (xvt.entry.toUpperCase()) {
				case 'D':
					if (Z < 99)
						Z++
				case 'R':
					break

				case 'U':
					if (Z > 0) {
						Z--
						break
					}
				case 'O':
					if (deep > 0)
						deep--
					else {
						$.music('.')
						xvt.out(`\x1B[1;${$.player.rows}r`)
						xvt.plot($.player.rows, 1)
						require('./main').menu($.player.expert)
						return
					}
					break
			}
			generateLevel()
			menu()
		}, cancel:'O', enter:'R', eol:false, match:/U|D|O|R/i }
	}
	xvt.app.form['wizard'].prompt = `Teleport #${deep + 1}.${Z + 1}: `
	xvt.app.focus = 'wizard'
}

function quaff(v: number, it = true) {
	let potion = [
		'Vial of Slaad Secretions',
		'Potion of Cure Light Wounds',
		'Flask of Fire Water',
		'Potion of Mana',
		'Vial of Weakness',
		'Potion of Stamina',
		'Vial of Stupidity',
		'Potion of Wisdom',
		'Vial of Clumsiness',
		'Potion of Agility',
		'Vile Vial',
		'Potion of Charm',
		'Vial of Crack',
		'Potion of Augment',
		'Beaker of Death',
		'Elixir of Restoration'
	]

	xvt.out(v % 2 ? xvt.green : xvt.red)
	xvt.out('It was', $.an(potion[v]), '.\n', xvt.reset)

	if (it) {
		$.sound('quaff', 5)
		switch (v) {
	//	Vial of Slaad Secretions
		case 0:
			$.sound('hurt')
			if (($.online.hp -= $.dice($.player.hp >>1)) < 1)
				$.reason = `quaffed${$.an(potion[v])}`
			break

	//	Potion of Cure Light Wounds
		case 1:
			$.sound('yum')
			$.online.hp += $.dice($.player.hp - $.online.hp)
			break

	//	Flask of Fire Water
		case 2:
			if (($.online.sp -= $.dice($.online.sp >>1)) < 1)
				$.online.sp = 0
			break

	//	Potion of Mana
		case 3:
			$.sound('shimmer')
			$.online.sp += $.dice($.player.sp - $.online.sp)
			break

	//	Vial of Weakness
		case 4:
			$.online.str = $.PC.ability($.online.str, -$.dice(10))
			break

	//	Potion of Stamina
		case 5:
			$.online.str = $.PC.ability($.online.str, $.dice(10))
			break

	//	Vial of Stupidity
		case 6:
			$.online.int = $.PC.ability($.online.int, -$.dice(10))
			break

	//	Potion of Wisdom
		case 7:
			$.online.int = $.PC.ability($.online.int, $.dice(10))
			break

	//	Vial of Clumsiness
		case 8:
			$.online.dex = $.PC.ability($.online.dex, -$.dice(10))
			break

	//	Potion of Agility
		case 9:
			$.online.dex = $.PC.ability($.online.dex, $.dice(10))
			break

	//	Vile Vial
		case 10:
			$.online.cha = $.PC.ability($.online.cha, -$.dice(10))
			break

	//	Potion of Charm
		case 11:
			$.online.cha = $.PC.ability($.online.cha, $.dice(10))
			break

	//	Vial of Crack
		case 12:
			$.player.maxstr = $.PC.ability($.player.maxstr, $.player.maxstr > 75 ? -$.dice(5) : -1)
			$.player.maxint = $.PC.ability($.player.maxint, $.player.maxint > 75 ? -$.dice(5) : -1)
			$.player.maxdex = $.PC.ability($.player.maxdex, $.player.maxdex > 75 ? -$.dice(5) : -1)
			$.player.maxcha = $.PC.ability($.player.maxcha, $.player.maxcha > 75 ? -$.dice(5) : -1)
			$.player.str = $.PC.ability($.player.str, $.player.str > 50 ? -$.dice(5) : -1)
			$.player.int = $.PC.ability($.player.int, $.player.int > 50 ? -$.dice(5) : -1)
			$.player.dex = $.PC.ability($.player.dex, $.player.dex > 50 ? -$.dice(5) : -1)
			$.player.cha = $.PC.ability($.player.cha, $.player.cha > 50 ? -$.dice(5) : -1)
			$.online.str = $.PC.ability($.online.str, $.online.str > 25 ? -$.dice(5) : -1)
			$.online.int = $.PC.ability($.online.int, $.online.int > 25 ? -$.dice(5) : -1)
			$.online.dex = $.PC.ability($.online.dex, $.online.dex > 25 ? -$.dice(5) : -1)
			$.online.cha = $.PC.ability($.online.cha, $.online.cha > 25 ? -$.dice(5) : -1)
			break

	//	Potion of Augment
		case 13:
			$.player.maxstr = $.PC.ability($.player.maxstr, $.player.maxstr < 95 ? $.dice(3) : 1)
			$.player.maxint = $.PC.ability($.player.maxint, $.player.maxint < 95 ? $.dice(3) : 1)
			$.player.maxdex = $.PC.ability($.player.maxdex, $.player.maxdex < 95 ? $.dice(3) : 1)
			$.player.maxcha = $.PC.ability($.player.maxcha, $.player.maxcha < 95 ? $.dice(3) : 1)
			$.player.str = $.PC.ability($.player.str, $.dice(10), $.player.maxstr)
			$.player.int = $.PC.ability($.player.int, $.dice(10), $.player.maxint)
			$.player.dex = $.PC.ability($.player.dex, $.dice(10), $.player.maxdex)
			$.player.cha = $.PC.ability($.player.cha, $.dice(10), $.player.maxcha)
			$.online.str = $.PC.ability($.online.str, $.dice(100 - $.online.str))
			$.online.int = $.PC.ability($.online.int, $.dice(100 - $.online.int))
			$.online.dex = $.PC.ability($.online.dex, $.dice(100 - $.online.dex))
			$.online.cha = $.PC.ability($.online.cha, $.dice(100 - $.online.cha))
			break

	//	Beaker of Death
		case 14:
			$.sound('killed', 12)
			$.online.hp = 0
			$.online.sp = 0
			$.reason = `quaffed${$.an(potion[v])}`
			break

	//	Elixir of Restoration
		case 15:
			$.sound('cure')
			$.online.hp = $.player.hp
			$.online.sp = $.player.sp
			break
		}
	}

	pause = true
}

}

export = Dungeon
