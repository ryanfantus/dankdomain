/*****************************************************************************\
 *  Dank Domain: the return of Hack & Slash                                  *
 *  DUNGEON authored by: Robert Hurst <theflyingape@gmail.com>               *
\*****************************************************************************/

import $ = require('../common')
import Battle = require('../battle')
import xvt = require('xvt')

module Dungeon
{
let dank: number
let level: number
let monsters: dungeon[] = [
	{ name:"goblin", pc:"Beast" },
	{ name:"orc", pc:"Beast" },
	{ name:"kobold", pc:"Beast" },
	{ name:"hobgoblin", pc:"Lizard" },
	{ name:"bullywug", pc:"Beast" },
	{ name:"xvart", pc:"Beast" },
	{ name:"caveman", pc:"Ogre" },
	{ name:"norker", pc:"Beast" },
	{ name:"skeleton", pc:"Undead" },
	{ name:"zombie", pc:"Undead", spells: [ "Armor Rusting", "Weapon Decay" ] },
	{ name:"giant centipede", pc:"Beast" },
	{ name:"gnoll", pc:"Beast" },
	{ name:"stirge", pc:"Beast" },
	{ name:"troglodyte", pc:"Ogre" },
	{ name:"lizard man", pc:"Lizard" },
	{ name:"crabman", pc:"Beast" },
	{ name:"mongrelman", pc:"Beast" },
	{ name:"ogrillon", pc:"Ogre", spells: [ "Heal" ] },
	{ name:"githzerai", pc:"Demon", spells: [ "Heal" ] },
	{ name:"kuo-toa", pc:"Lizard", spells: [ "Heal", "Teleport" ] },
	{ name:"bugbear" ,pc:"Beast", spells: [ "Heal" ] },
	{ name:"ghoul", pc:"Undead", spells: [ "Heal", "Teleport", "Armor Rusting", "Weapon Decay" ] },
	{ name:"ogre" ,pc:"Ogre", spells: [ "Heal", "Teleport" ] },
	{ name:"firedrake" ,pc:"Dragon", spells: [ "Heal", "Teleport", "Big Blast" ] },
	{ name:"drow", pc:"Demon", spells: [ "Heal", "Teleport" ] },
	{ name:"firenewt", pc:"Lizard", spells: [ "Heal", "Teleport" ] },
	{ name:"harpy", pc:"Beast", spells: [ "Armor Rusting", "Weapon Decay" ] },
	{ name:"ophidian", pc:"Lizard" },
	{ name:"phantom", pc:"Undead", spells: [ "Heal", "Teleport", "Blast", "Armor Rusting", "Weapon Decay" ] },
	{ name:"worg", pc:"Beast" },
	{ name:"gargoyle", pc:"Beast" },
	{ name:"rust monster", pc:"Beast", spells: [ "Armor Rusting", "Super Shield" ] },
	{ name:"ghast", pc:"Undead", spells: [ "Heal", "Teleport", "Blast", "Armor Rusting", "Weapon Decay", "Big Blast" ] },
	{ name:"werewolf", pc:"Undead", spells: [ "Heal", "Teleport" ] },
	{ name:"owlbear", pc:"Beast" },
	{ name:"firetoad", pc:"Lizard" },
	{ name:"hell hound", pc:"Demon" },
	{ name:"hook horror", pc:"Beast" },
	{ name:"anhkheg", pc:"Lizard" },
	{ name:"githyanki", pc:"Demon", spells: [ "Heal", "Teleport", "Blast" ] },
	{ name:"cave bear", pc:"Beast" },
	{ name:"cockatrice", pc:"Lizard" },
	{ name:"minotaur", pc:"Beast" },
	{ name:"displacer beast", pc:"Beast", spells: [ "Teleport" ] },
	{ name:"doppleganger", pc:null, spells: [ "Heal", "Teleport", "Blast" ] },
	{ name:"imp", pc:"Demon", spells:[ "Heal", "Teleport", "Blast", "Big Blast" ] },
	{ name:"quasit", pc:"Demon", spells:[ "Heal", "Teleport", "Blast" ] },
	{ name:"ice lizard", pc:"Lizard", spells: [ "Super Shield", "Super Hone" ] },
	{ name:"svirfneblin", pc:"Beast" },
	{ name:"yeti", pc:"Beast" },
	{ name:"carrion crawler", pc:"Lizard", spells: [ "Confusion" ] },
	{ name:"manticore", pc:"Beast" },
	{ name:"troll", pc:"Ogre", spells: [ "Heal", "Teleport" ] },
	{ name:"wight", pc:"Undead", spells: [ "Blast", "Armor Rusting", "Weapon Decay", "Mana Stealing" ] },
	{ name:"wraith", pc:"Undead", spells: [ "Teleport", "Blast", "Armor Rusting", "Weapon Decay", "Big Blast" ] },
	{ name:"basilisk", pc:"Lizard" },
	{ name:"wyvern", pc:"Dragon", spells: [ "Heal", "Teleport", "Blast" ]  },
	{ name:"medusa", pc:"Titan", spells: [ "Confusion", "Life Stealing" ] },
	{ name:"drider", pc:"Beast" },
	{ name:"ogre mage", pc:"Ogre", spells: [ "Heal", "Teleport", "Mana Stealing" ] },
	{ name:"hill giant", pc:"Ogre" },
	{ name:"tunnel worm",pc:"Beast" },
	{ name:"hydra", pc:"Dragon", spells: [ "Heal", "Mana Stealing" ] },
	{ name:"mimic", pc:null, spells: [ "Heal", "Teleport", "Blast" ] },
	{ name:"succubus", pc:"Demon", spells: [ "Life Stealing" ] },
	{ name:"mind flayer", pc:"Demon", spells: [ "Confusion", "Mana Stealing" ] },
	{ name:"mummy", pc:"Undead", spells: [ "Level Stealing" ] },
	{ name:"neo-otyugh", pc:"Beast" },
	{ name:"roper", pc:"Beast" },
	{ name:"umber hulk", pc:"Ogre" },
	{ name:"pyrohydra", pc:"Dragon", spells: [ "Blast" ] },
	{ name:"will-o-wisp", pc:"None" },
	{ name:"vampire", pc:"Undead", spells: [ "Heal", "Teleport", "Confusion", "Life Stealing", "Level Stealing" ] },
	{ name:"ghost", pc:"Undead", spells: [ "Teleport", "Blast", "Mana Stealing", "Life Stealing", "Level Stealing" ] },
	{ name:"dracolisk", pc:"Lizard", spells: [ "Heal", "Teleport" ] },
	{ name:"naga", pc:"Beast" },
	{ name:"xag-ya", pc:"Beast", spells: [ "Teleport", "Super Shield", "Super Hone" ] },
	{ name:"xeg-yi", pc:"Beast", spells: [ "Teleport", "Super Shield", "Super Hone" ] },
	{ name:"minor demon", pc:"Demon", spells: [ "Heal", "Teleport", "Blast" ] },
	{ name:"green dragon", pc:"Dragon", spells: [ "Heal", "Teleport", "Armor Rusting", "Mana Stealing" ] },
	{ name:"red dragon", pc:"Dragon", spells: [ "Teleport", "Blast", "Weapon Decay", "Big Blast" ] },
	{ name:"stone golem", pc:"Ogre" },
	{ name:"nycadaemon", pc:"Demon", spells: [ "Heal", "Teleport", "Blast" ] },
	{ name:"titan", pc:"Titan" },
	{ name:"demilich", pc:"Undead", spells: [ "Heal", "Teleport", "Blast" ] },
	{ name:"pit fiend", pc:"Beast" },
	{ name:"lernaean hydra", pc:"Dragon" },
	{ name:"major demon", pc:"Demon" },
	{ name:"mist dragon", pc:"Dragon", spells: [ "Teleport", "Armor Rusting", "Weapon Decay", "Big Blast", "Super Shield" ] },
	{ name:"grey slaad", pc:"Lizard" },
	{ name:"beholder", pc:"Beast", spells: [ "Heal", "Teleport", "Blast", "Big Blast", "Mana Stealing", "Life Stealing" ] },
	{ name:"iron golem", pc:"Ogre" },
	{ name:"death slaad", pc:"Lizard" },
	{ name:"cloud dragon", pc:"Dragon", spells: [ "Teleport", "Big Blast", "Mana Stealing", "Level Stealing" ] },
	{ name:"lich", pc:"Undead", spells: [ "Heal", "Teleport", "Armor Rusting", "Weapon Decay", "Life Stealing", "Level Stealing" ] },
	{ name:"elder titan", pc:"Titan" },
	{ name:"slaad lord", pc:"Lizard" },
	{ name:"demon prince", pc:"Demon", spells: [ "Heal", "Super Shield" ] },
	{ name:"arch devil", pc:"Demon", spells: [ "Blast", "Super Hone" ] },
	{ name:"elemental prince", pc:"God", spells: [ "Confusion", "Cure", "Armor Rusting", "Weapon Decay", "Mana Stealing" ]  }
]
	let dungeon: choices = {
		'N': { description:'orth' },
		'S': { description:'outh' },
		'E': { description:'ast' },
		'W': { description:'est' },
		'M': { description:'ap' },
		'C': { description:'ast a spell' },
		'P': { description:'oison your weapon' },
		'Y': { description:'our status' }
	}

export function DeepDank(suppress = false) {
	dank = 0
	level = $.player.level - 1
	menu(suppress)
}

export function menu(suppress = false) {
	if ($.player.level < $.sysop.level)
		$.checkXP($.online)
	if ($.online.altered) $.saveUser($.player)
	if ($.reason) xvt.hangup()
	$.action('dungeon')
	
	xvt.app.form = {
        'command': { cb:command, prompt:':', enter:'?', eol:false }
    }
    xvt.app.focus = 'command'
}

function command() {
    let suppress = $.player.expert
    let choice = xvt.entry.toUpperCase()
    if (xvt.validator.isNotEmpty(dungeon[choice]))
        xvt.out(dungeon[choice].description, '\n')
    else {
        xvt.beep()
        suppress = false
    }

    switch (choice) {
		case 'N':
		case 'S':
		case 'E':
		case 'W':
			if ($.dice(100) == 100) {
				$.sound('teleport')
				require('./main').menu($.player.expert)
				return
			}
			if ($.dice(10) == 1) {
				if ($.dice(2) == 1) {
					xvt.out(xvt.magenta, '^>', xvt.bright, xvt.white, ' Oof! ', xvt.normal, xvt.magenta,'<^  ', xvt.reset
						, 'There is a wall to the ', choice.toLowerCase(), dungeon[choice].description,'.')
					xvt.waste(250)
					if (($.online.hp -= $.dice(Math.trunc($.player.level * (110 - $.online.str) / 100) + 1)) < 1) {
						xvt.out('\n')
						xvt.waste(250)
						xvt.out(xvt.bright, xvt.yellow, 'You take too many hits and die.\n', xvt.reset)
						xvt.waste(250)
						$.reason = 'banged head against a wall'
						xvt.hangup()
						return
					}
				}
				else {
					xvt.out(xvt.bright, xvt.yellow, '\nYou\'ve fallen down a level!\n', xvt.reset)
					level++
				}
			}
			if ($.dice(3) == 1) {
				xvt.out('\nThere\'s something lurking in here . . . \n')
				let monster: active[] = new Array()
				let n = 0
				do {
					monster.push(<active>{})
					monster[n].user = <user>{id: ''}
					let mon = level + $.dice(7) - 4
					mon = mon < 0 ? 0 : mon >= monsters.length ? monsters.length - 1 : mon
					monster[n].user.handle = monsters[mon].name
					monster[n].user.sex = 'I'
					$.reroll(monster[n].user, monsters[mon].pc ? monsters[mon].pc : $.player.pc, mon)
					monster[n].user.weapon = Math.trunc(mon / 2)
					monster[n].user.armor = Math.trunc(mon / 4)
					monster[n].user.hp = Math.trunc(monster[n].user.hp / 8)
					$.activate(monster[n])
					monster[n].user.coin = new $.coins($.money(mon))

					$.action('battle')
					$.cat('dungeon/' + monster[n].user.handle)
					$.profile({ jpg:'dungeon/' + monster[n].user.handle
						, handle:monster[n].user.handle
						, level:monster[n].user.level, pc:monster[n].user.pc
					})
					
					xvt.waste(750)
					xvt.out(xvt.reset, '\nIt\'s ', $.an(monster[n].user.handle), monster[n].user.handle, '!')
					xvt.waste(500)
					xvt.out('  And it doesn\'t look friendly.\n')
					xvt.waste(500)

					if (isNaN(+monster[n].user.weapon)) xvt.out('\n', $.who(monster[n], 'He'), $.Weapon.wearing(monster[n]), '.\n')
					if (isNaN(+monster[n].user.armor)) xvt.out('\n', $.who(monster[n], 'He'), $.Armor.wearing(monster[n]), '.\n')
				} while (++n < 3 && $.dice(3) == 1)
				Battle.engage('Dungeon', $.online, monster, menu)
				return
			}
			break

        case 'Q':
			if ($.Access.name[$.player.access].sysop) {
				require('./main').menu($.player.expert)
				return
			}

		case 'Y':
			Battle.yourstats()
			break

		default:
			xvt.beep()
    	    suppress = false
	}
	menu(suppress)
}

}

export = Dungeon
