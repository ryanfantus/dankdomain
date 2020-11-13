/*****************************************************************************\
 *  Ɗanƙ Ɗomaiƞ: the return of Hack & Slash                                  *
 *  ARENA authored by: Robert Hurst <theflyingape@gmail.com>                 *
\*****************************************************************************/

import $ = require('../common')
import xvt = require('xvt')
import Battle = require('../battle')
import { isNotEmpty } from 'class-validator'
import { sprintf } from 'sprintf-js'

module Arena {

    let monsters: monster[] = require('../etc/arena.json')
    let arena: choices = {
        'U': { description: 'User fights' },
        'M': { description: 'Monster fights' },
        'J': { description: 'Joust users' },
        'C': { description: 'Cast a spell' },
        'P': { description: 'Poison your weapon' },
        'G': { description: 'Goto the square' },
        'Y': { description: 'Your status' }
    }

    export function menu(suppress = true) {
        $.from = 'Arena'
        if ($.checkXP($.online, menu)) return
        if ($.online.altered) $.saveUser($.online)
        if ($.reason) xvt.hangup()

        $.action('arena')
        xvt.app.form = {
            'menu': { cb: choice, cancel: 'q', enter: '?', eol: false }
        }

        let hints = ''
        if (!suppress) {
            if ($.online.hp < $.player.hp)
                hints += `> Buy Hit Points!\n`
            if ($.joust)
                hints += `> Try jousting another player to win money.\n`
            if ($.player.poisons.length && !$.online.toWC)
                hints += `> Don\'t forget to poison your weapon.\n`
            if ($.player.coin.value)
                hints += `> Carrying money around here is not a good idea.  Spend it in the Square\n  or deposit it in the Bank for safer keeping.\n`
        }
        xvt.app.form['menu'].prompt = $.display('arena', xvt.Red, xvt.red, suppress, arena, hints)
        xvt.app.focus = 'menu'
    }

    function choice() {
        let suppress = false
        let choice = xvt.entry.toUpperCase()
        if (isNotEmpty(arena[choice]))
            if (isNotEmpty(arena[choice].description)) {
                xvt.out(' - ', arena[choice].description)
                suppress = $.player.expert
            }
        xvt.out('\n')

        switch (choice) {
            case 'C':
                if (!$.access.roleplay) break
                Battle.cast($.online, menu)
                return

            case 'G':
                $.action('clear')
                require('./square').menu($.player.expert)
                return

            case 'J':
                if (!$.joust) {
                    xvt.outln('\nYou have run out of jousts.')
                    suppress = true
                    break
                }
                Battle.user('Joust', (opponent: active) => {
                    if (opponent.user.id == '') {
                        menu()
                        return
                    }
                    xvt.outln()
                    if (opponent.user.id == $.player.id) {
                        opponent.user.id = ''
                        xvt.outln(`You can't joust a wimp like `, $.online.who.him)
                        menu()
                        return
                    }
                    if ($.player.level - opponent.user.level > 3) {
                        xvt.outln('You can only joust someone higher or up to three levels below you.')
                        menu(true)
                        return
                    }

                    let ability = $.PC.jousting($.online)
                    let versus = $.PC.jousting(opponent)
                    let factor = (100 - ($.player.level > opponent.user.level ? $.player.level : opponent.user.level)) / 10 + 3
                    let jw = 0
                    let jl = 0
                    let pass = 0

                    if (!$.Access.name[opponent.user.access].roleplay || versus < 1 || opponent.user.level > 1 && (opponent.user.jw + 3 * opponent.user.level) < opponent.user.jl) {
                        xvt.outln('That knight is out practicing right now.')
                        menu(true)
                        return
                    }

                    xvt.outln('Jousting ability:\n')
                    xvt.out(xvt.bright, xvt.green, sprintf('%-25s', opponent.user.handle), xvt.white, sprintf('%4d', versus))
                    if (opponent.user.id == $.king.id) xvt.out(xvt.normal, ' - ', xvt.magenta, 'The Crown')
                    xvt.outln()
                    xvt.outln(xvt.bright, xvt.green, sprintf('%-25s', $.player.handle), xvt.white, sprintf('%4d', ability))
                    xvt.outln()
                    if ((ability + factor * $.player.level) < (versus + 1)) {
                        xvt.outln(opponent.user.handle, ' laughs rudely in your face!\n')
                        menu(true)
                        return
                    }

                    $.action('ny')
                    xvt.app.form = {
                        'compete': {
                            cb: () => {
                                xvt.outln('\n')
                                if (/Y/i.test(xvt.entry)) {
                                    if ($.joust-- > 2) $.music('joust')
                                    $.profile({
                                        jpg: 'arena/joust'
                                        , handle: opponent.user.handle
                                        , level: opponent.user.level, pc: opponent.user.pc
                                        , effect: 'slideInLeft'
                                    })
                                    xvt.out('The trumpets blare! ', -400, 'You and your opponent ride into the arena. ', -400)
                                    xvt.outln(opponent.user.id == $.king.id ? '\nThe crowd goes silent.' : 'The crowd roars!', -400)
                                    $.online.altered = true
                                    $.action('joust')

                                    round()
                                    xvt.app.focus = 'joust'
                                    return
                                }
                                menu()
                                return
                            }, prompt: 'Are you sure (Y/N)? ', cancel: 'N', enter: 'N', eol: false, match: /Y|N/i, max: 1, timeout: 10
                        },
                        'joust': {
                            cb: () => {
                                xvt.outln('\n')
                                if (/F/i.test(xvt.entry)) {
                                    $.log(opponent.user.id, `\n${$.player.handle} forfeited to you in a joust.`)
                                    $.animated('pulse')
                                    if (opponent.user.id == $.king.id) {
                                        $.sound('cheer')
                                        $.PC.adjust('cha', 101)
                                        xvt.outln('The crowd is delighted by your show of respect to the Crown.', -300)
                                    }
                                    else {
                                        $.sound('boo')
                                        $.animated('slideOutRight')
                                        $.player.jl++
                                        $.run(`UPDATE Players set jw=jw+1 WHERE id='${opponent.user.id}'`)
                                        xvt.outln('The crowd throws rocks at you as you ride out of the arena.', -300)
                                    }
                                    menu()
                                    return
                                }
                                if (/J/i.test(xvt.entry)) {
                                    xvt.outln('You spur the horse. ', -200, 'The tension mounts. ', -200)
                                    let result = 0
                                    while (!result)
                                        result = (ability + $.dice(factor * $.player.level)) - (versus + $.dice(factor * opponent.user.level))
                                    if (result > 0) {
                                        $.sound('wall')
                                        $.animated(['flash', 'jello', 'rubberBand'][jw])
                                        xvt.outln(xvt.green, '-*>', xvt.bright, xvt.white, ' Thud! ', xvt.normal, xvt.green, '<*-  ', xvt.reset, 'A hit! ', -100, ' You win this pass!', -100)
                                        if (++jw == 3) {
                                            xvt.outln('\nYou have won the joust!')
                                            if (opponent.user.id == $.king.id) {
                                                $.sound('boo')
                                                $.animated('fadeOut')
                                                $.PC.adjust('cha', -2, -1)
                                                xvt.outln('The crowd is furious!', -250)
                                            }
                                            else {
                                                $.sound('cheer')
                                                $.animated('hinge')
                                                xvt.outln('The crowd cheers!', -250)
                                            }
                                            let reward = new $.coins($.money(opponent.user.level))
                                            $.player.coin.value += reward.value
                                            $.player.jw++
                                            if ($.run(`UPDATE Players set jl=jl+1 WHERE id='${opponent.user.id}'`).changes)
                                                $.log(opponent.user.id, `\n${$.player.handle} beat you in a joust and got ${reward.carry(2, true)}.`)
                                            xvt.outln('You win ', reward.carry(), '!', -250)
                                            if ($.player.jw > 14 && $.player.jw / ($.player.jw + $.player.jl) > 0.9) {
                                                let ring = $.Ring.power([], null, 'joust')
                                                if ($.Ring.wear($.player.rings, ring.name)) {
                                                    $.getRing('win', ring.name)
                                                    $.saveRing(ring.name, $.player.id, $.player.rings)
                                                }
                                            }
                                            menu()
                                            return
                                        }
                                    }
                                    else {
                                        if ($.Ring.power(opponent.user.rings, $.player.rings, 'joust').power
                                            && !$.Ring.power($.player.rings, opponent.user.rings, 'joust').power && $.dice(3) == 1) {
                                            $.sound('swoosh')
                                            xvt.out(xvt.magenta, '^>', xvt.white, ' SWOOSH ', xvt.magenta, '<^  ', xvt.reset
                                                , $.PC.who(opponent).He, 'missed! ', -100, ' You both pass and try again!', -100)
                                            xvt.app.refocus()
                                            return
                                        }

                                        $.animated(['bounce', 'shake', 'tada'][jl])
                                        $.sound('oof')
                                        xvt.outln(xvt.magenta, '^>', xvt.bright, xvt.white, ' Oof! ', xvt.normal, xvt.magenta, '<^  ', xvt.reset
                                            , $.PC.who(opponent).He, 'hits! ', -100, ' You lose this pass!', -100)
                                        if (++jl == 3) {
                                            xvt.outln('\nYou have lost the joust!')
                                            $.sound('boo')
                                            xvt.outln('The crowd boos you!', -200)
                                            let reward = new $.coins($.money($.player.level))
                                            $.player.jl++
                                            if ($.run(`UPDATE Players set jw=jw+1, coin=coin+${reward.value} WHERE id='${opponent.user.id}'`).changes)
                                                $.log(opponent.user.id, `\n${$.player.handle} lost to you in a joust.  You got ${reward.carry(2, true)}.`)
                                            $.news(`\tlost to ${opponent.user.handle} in a joust`)
                                            $.wall(`lost to ${opponent.user.handle} in a joust`)
                                            $.animated('slideOutRight')
                                            xvt.outln(opponent.user.handle, ' spits on your face.', -300)
                                            menu()
                                            return
                                        }
                                    }
                                    round()
                                }
                                xvt.app.refocus()
                            }, prompt: xvt.attr('        ', $.bracket('J', false), xvt.bright, xvt.yellow, ' Joust', xvt.normal, xvt.magenta, ' * ', $.bracket('F', false), xvt.bright, xvt.yellow, ' Forfeit: '), cancel: 'F', enter: 'J', eol: false, match: /F|J/i
                        }
                    }
                    xvt.outln('You grab a horse and prepare yourself to joust.')
                    xvt.app.focus = 'compete'

                    function round() {
                        xvt.out('\n', xvt.green, '--=:)) Round ', xvt.romanize(++pass), ' of V: Won:', xvt.bright, xvt.white, jw.toString(), xvt.normal, xvt.magenta, ' ^', xvt.green, ' Lost:', xvt.bright, xvt.white, jl.toString(), xvt.normal, xvt.green, ' ((:=--')
                    }
                })
                return

            case 'M':
                if (!$.arena) {
                    xvt.outln('\nYou have no more arena fights.')
                    suppress = true
                    break
                }
                $.action('monster')
                xvt.app.form = {
                    pick: {
                        cb: () => {
                            if (xvt.entry.length) {
                                let mon = $.int(xvt.entry)
                                if (! /D/i.test(xvt.entry)) {
                                    if (mon < 1 || mon > monsters.length) {
                                        xvt.out(' ?? ')
                                        xvt.app.refocus()
                                        return
                                    }
                                    xvt.entry = mon.toString()
                                }
                                xvt.outln()
                                if (!MonsterFights())
                                    menu()
                            }
                            else {
                                xvt.outln()
                                menu()
                            }
                        }
                        , prompt: 'Fight what monster (' + xvt.attr(xvt.white, '1-' + monsters.length, xvt.cyan, ', ', $.bracket('D', false), xvt.cyan, 'emon)? ')
                        , min: 0, max: 2
                    }
                }
                xvt.app.focus = 'pick'
                return

            case 'P':
                if (!$.access.roleplay) break
                Battle.poison($.online, menu)
                return

            case 'Q':
                require('./main').menu($.player.expert)
                return

            case 'U':
                if (!$.arena) {
                    xvt.outln('\nYou have no more arena fights.')
                    suppress = true
                    break
                }
                Battle.user('Fight', (opponent: active) => {
                    if (opponent.user.id == '') {
                        menu()
                        return
                    }
                    if (opponent.user.id == $.player.id) {
                        opponent.user.id = ''
                        xvt.outln(`\nYou can't fight a wimp like `, $.PC.who(opponent).him)
                        menu()
                        return
                    }
                    if ($.player.level - opponent.user.level > 3) {
                        xvt.outln('\nYou can only fight someone higher or up to three levels below you.')
                        menu()
                        return
                    }

                    $.cat('player/' + opponent.user.pc.toLowerCase())
                    xvt.out(opponent.user.handle, ' ')

                    if (opponent.user.status.length) {
                        xvt.out('was defeated by ')
                        let rpc: active = { user: { id: opponent.user.status } }
                        if ($.loadUser(rpc))
                            xvt.out(rpc.user.handle, xvt.cyan, ' (', xvt.bright, xvt.white, opponent.user.xplevel.toString(), xvt.normal, xvt.cyan, ')')
                        else
                            xvt.out(opponent.user.status)
                        xvt.outln()
                        menu()
                        return
                    }
                    xvt.out(`is a level ${opponent.user.level} ${opponent.user.pc}`)
                    if ($.player.emulation == 'XT') xvt.out(' ', opponent.pc.color || xvt.white, opponent.pc.unicode, xvt.reset)
                    if (opponent.user.level !== opponent.user.xplevel)
                        xvt.out(' ', $.bracket(opponent.user.xplevel, false))
                    xvt.outln()

                    if ($.player.novice && !opponent.user.novice) {
                        xvt.outln('You are allowed only to fight other novices.')
                        menu()
                        return
                    }

                    if (!$.Access.name[opponent.user.access].roleplay) {
                        xvt.outln('You are allowed only to fight other players.')
                        if (opponent.user.id[0] == '_') {
                            $.PC.adjust('cha', -2, -1)
                            $.player.coward = true
                            $.online.altered = true
                        }
                        menu()
                        return
                    }

                    if (!$.player.novice && opponent.user.novice) {
                        xvt.outln('You are not allowed to fight novices.')
                        menu()
                        return
                    }

                    if (!$.lock(opponent.user.id)) {
                        $.beep()
                        xvt.outln(xvt.cyan, xvt.faint, `${$.PC.who(opponent).He}is currently engaged elsewhere and not available.`)
                        menu()
                        return
                    }

                    $.PC.wearing(opponent)

                    $.action('ny')
                    xvt.app.form = {
                        'fight': {
                            cb: () => {
                                xvt.outln()
                                if (/Y/i.test(xvt.entry)) {
                                    if ($.activate(opponent, true)) {
                                        $.music('combat' + $.arena--)
                                        Battle.engage('User', $.online, opponent, menu)
                                    }
                                    else {
                                        $.unlock($.player.id, true)
                                        menu($.player.expert)
                                    }
                                }
                                else
                                    menu($.player.expert)
                            }, prompt: `Will you fight ${$.PC.who(opponent).him}(Y/N)? `, cancel: 'N', enter: 'N', eol: false, match: /Y|N/i, max: 1, timeout: 10
                        }
                    }
                    xvt.app.focus = 'fight'
                })
                return

            case 'Y':
                xvt.outln()
                Battle.yourstats()
                suppress = true
                break
        }
        menu(suppress)
    }

    function MonsterFights(): boolean {

        let cost: $.coins
        let monster: active
        let n: number

        $.action('clear')
        if (/D/i.test(xvt.entry)) {
            if ($.player.level < 50) {
                xvt.outln('\nYou are not powerful enough to fight demons yet.  Go fight some monsters.')
                return
            }

            cost = new $.coins(new $.coins($.money($.player.level)).carry(1, true))

            xvt.outln('\nThe ancient necromancer will summon you a demon for ', cost.carry())
            if ($.player.coin.value < cost.value) {
                xvt.outln(`You don't have enough!`)
                return
            }

            $.action('yn')
            xvt.app.form = {
                'pay': {
                    cb: () => {
                        xvt.outln('\n')
                        if (/Y/i.test(xvt.entry)) {
                            $.player.coin.value -= cost.value
                            $.online.altered = true
                            xvt.outln('As you hand him the money, it disappears into thin air ... ', -1200, '\n')

                            monster = <active>{}
                            monster.user = <user>{ id: '' }
                            Object.assign(monster.user, require('../etc/summoned demon.json'))
                            let l = $.player.level + 2
                            if (l >= $.sysop.level)
                                l = $.sysop.level - 2
                            if ((monster.user.level = l + $.dice(7) - 4) > 99)
                                monster.user.level = 99
                            cost.value += $.worth($.money(monster.user.level), $.player.cha)

                            let n = Math.trunc($.Weapon.merchant.length * $.player.level / 110)
                            n = n >= $.Weapon.merchant.length ? $.Weapon.merchant.length - 1 : n
                            monster.user.weapon = n + 3
                            cost.value += $.worth(new $.coins($.Weapon.name[$.Weapon.merchant[n]].value).value, $.player.cha)

                            n = Math.trunc($.Armor.merchant.length * $.player.level / 110)
                            n = n >= $.Armor.merchant.length ? $.Armor.merchant.length - 1 : n
                            monster.user.armor = n + 2
                            cost.value += $.worth(new $.coins($.Armor.name[$.Armor.merchant[n]].value).value, $.player.cha)

                            $.reroll(monster.user
                                , ($.dice(($.online.int + $.online.cha) / 50) > 1) ? monster.user.pc : $.PC.random('monster')
                                , monster.user.level)

                            monster.user.spells = [7, 9]
                            if (monster.user.magic) {
                                for (let i = 0; i < Object.keys($.Magic.spells).length; i++) {
                                    if ($.dice(($.player.cha >> 2) + 5 * i + $.player.level - monster.user.level) <= monster.user.magic) {
                                        let spell = $.Magic.pick(i)
                                        if (!$.Magic.have(monster.user.spells, spell))
                                            $.Magic.add(monster.user.spells, i)
                                    }
                                }
                            }
                            if (monster.user.poison) {
                                for (let i = 0; i < Object.keys($.Poison.vials).length; i++) {
                                    if ($.dice(($.player.cha >> 2) + 5 * i + $.player.level - monster.user.level) <= monster.user.poison) {
                                        let vial = $.Poison.pick(i)
                                        if (!$.Poison.have(monster.user.poisons, vial))
                                            $.Poison.add(monster.user.poisons, i)
                                    }
                                }
                            }

                            $.activate(monster)
                            monster.user.coin.value += cost.value

                            $.profile({
                                jpg: 'arena/' + monster.user.handle.toLowerCase()
                                , handle: `${monster.user.handle}`, level: monster.user.level, pc: 'contest'
                                , effect: 'jello'
                            })
                            $.cat('arena/' + monster.user.handle)

                            xvt.outln(`The old necromancer summons you a level ${monster.user.level} creature.`)
                            $.PC.wearing(monster)

                            $.action('ny')
                            xvt.app.focus = 'fight'
                            return
                        }
                        xvt.outln(xvt.cyan, 'His eyes glow ', xvt.red, xvt.bright, 'red', xvt.normal
                            , xvt.cyan, ' and says, "', xvt.white, xvt.bright, `I don't make deals!`, xvt.normal, xvt.cyan, '"')
                        menu()
                    }, prompt: 'Will you pay (Y/N)? ', cancel: 'N', enter: 'Y', eol: false, match: /Y|N/i, max: 1, timeout: 10
                },
                'fight': {
                    cb: () => {
                        xvt.outln()
                        if (/Y/i.test(xvt.entry)) {
                            $.music('combat' + $.arena--)
                            Battle.engage('Monster', $.online, monster, menu)
                        }
                        else {
                            $.animated('fadeOut')
                            menu()
                        }
                    }, prompt: 'Fight this demon (Y/N)? ', cancel: 'N', enter: 'N', eol: false, match: /Y|N/i, max: 1, timeout: 30
                }
            }
            xvt.app.focus = 'pay'
        }
        else {
            let mon = $.int(xvt.entry) - 1
            if (mon == monsters.length - 1) $.sound('demogorgon')
            monster = <active>{}
            monster.user = <user>{ id: '', handle: monsters[mon].name, sex: 'I' }
            $.reroll(monster.user, monsters[mon].pc, monsters[mon].level)

            monster.user.weapon = monsters[mon].weapon
            monster.user.armor = monsters[mon].armor
            monster.user.rings = monsters[mon].rings || []
            monster.user.spells = []
            if (monsters[mon].spells)
                for (let i = 0; i < monsters[mon].spells.length; i++)
                    $.Magic.add(monster.user.spells, monsters[mon].spells[i])

            $.activate(monster)
            if (monsters[mon].adept) monster.adept = monsters[mon].adept
            monster.user.coin.amount = monsters[mon].money.toString()

            $.cat('arena/' + monster.user.handle.toLowerCase())
            $.profile({
                jpg: 'arena/' + monster.user.handle.toLowerCase()
                , handle: `#${mon + 1} - ${monster.user.handle}`
                , level: monster.user.level, pc: monster.user.pc.toLowerCase()
                , effect: monsters[mon].effect
            })

            xvt.out(`The ${monster.user.handle} is a level ${monster.user.level} ${monster.user.pc}`)
            if ($.player.emulation == 'XT') xvt.out(' ', monster.pc.color || xvt.white, monster.pc.unicode)
            xvt.outln()
            $.PC.wearing(monster)

            $.action('ny')
            xvt.app.form = {
                'fight': {
                    cb: () => {
                        xvt.outln()
                        if (/Y/i.test(xvt.entry)) {
                            if (mon == monsters.length - 1)
                                $.music('boss' + $.arena--)
                            else
                                $.music('combat' + $.arena--)
                            Battle.engage('Monster', $.online, monster, menu)
                        }
                        else {
                            $.animated('fadeOut')
                            menu()
                        }
                    }, prompt: 'Will you fight it (Y/N)? ', cancel: 'N', enter: 'N', eol: false, match: /Y|N/i, max: 1, timeout: 10
                }
            }
            xvt.app.focus = 'fight'
        }

        return true
    }

}

export = Arena
