/*****************************************************************************\
 *  Ɗanƙ Ɗomaiƞ: the return of Hack & Slash                                  *
 *  COMMON authored by: Robert Hurst <theflyingape@gmail.com>                *
\*****************************************************************************/

import fs = require('fs')
import xvt = require('xvt')
import Items = require('./items')
import { isDefined, isEmpty, isNotEmpty } from 'class-validator'
import { sprintf } from 'sprintf-js'
import { titleCase } from 'title-case'

module Common {

    //  mode of operation
    export const got = require('got')
    export let from = 'Common'
    export const romanize = require('romanize')
    export let tty: TTY = 'telnet'
    switch (xvt.app.emulation) {
        case 'PC':
            tty = 'rlogin'
            break
        case 'XT':
            tty = 'web'
            xvt.out('\x1B]2;', process.title, '\x07')
            break
        default:
            xvt.app.emulation = 'VT'
            xvt.out('\f')
    }
    export const users = './users'

    //  items
    export const Abilities = ['str', 'int', 'dex', 'cha']
    export const Access = new Items.Access
    export const Armor = new Items.Armor
    export const Deed = new Items.Deed
    export const Ring = new Items.Ring
    export const Magic = new Items.Magic(Ring)
    export const Poison = new Items.Poison
    export const RealEstate = new Items.RealEstate
    export const Security = new Items.Security
    export const Weapon = new Items.Weapon

    //  maintain usual suspects
    export let barkeep: active = { user: { id: '_BAR' } }
    export let dwarf: active = { user: { id: '_DM' } }
    export let neptune: active = { user: { id: '_NEP' } }
    export let seahag: active = { user: { id: '_OLD' } }
    export let taxman: active = { user: { id: '_TAX' } }
    export let witch: active = { user: { id: '_WOW' } }
    export let king: user = { id: '' }
    export let online: active = { user: { id: '' } }
    export let player: user = online.user
    export let sysop: user = { id: '_SYS' }

    //  player runtime features
    export let access: access
    export let arena: number = 0
    export let argue: number = 0
    export let bail: number = 0
    export let brawl: number = 0
    export let dungeon: number = 0
    export let joust: number = 0
    export let jumped: number = 0
    export let naval: number = 0
    export let party: number = 0
    export let realestate: number = 0
    export let security: number = 0
    export let sorceress: number = 0
    export let steal: number = 0
    export let taxboss: number = 0
    export let tiny: number = 0
    export let timeleft: number = 0
    export let warning: number = 2

    export let callers: caller[] = []
    export let mydeeds: deed[]
    export let reason: string = ''
    export let remote = process.env.REMOTEHOST || process.env.SSH_CLIENT || ''
    export let whereis = [
        'Braavos', 'Casterly Rock', 'Dorne', 'Dragonstone', 'Dreadfort',
        'The Eyrie', 'Harrenhal', 'Highgarden', 'Iron Island', `King's Landing`,
        'Meereen', 'Norvos', 'Oldtown', 'Pentos', 'Qohor',
        'Riverrun', 'The Twins', 'The Wall', 'Winterfell', 'Volantis'
    ][dice(20) - 1]

    //  all player characters
    export class Character {
        constructor() {
            this.name = require('./etc/dankdomain.json')
            this.types = Object.keys(this.name).length
            this.classes = new Array()
            this.total = 0
            for (let type in this.name) {
                let i = Object.keys(this.name[type]).length
                this.classes.push({ key: type, value: i })
                this.total += i
                if (type == 'immortal')
                    for (let dd in this.name[type])
                        this.winning = dd
            }
        }

        name: character[]
        types: number
        classes: { key?: string, value?: number }[]
        total: number
        winning: string

        ability(current: number, delta: number, max = 100, mod = 0): number {
            let ability = current
            max = max + mod
            max = max > 100 ? 100 : max < 20 ? 20 : max
            ability += delta
            ability = ability > max ? max : ability < 20 ? 20 : ability
            return ability
        }

        adjust(ability: ABILITY, rt = 0, pc = 0, max = 0, rpc = online) {
            if (max) {
                rpc.user[`max${ability}`] = this.ability(rpc.user[`max${ability}`], max, 99)
                rpc.altered = true
            }
            if (pc) {
                rpc.user[ability] = this.ability(rpc.user[ability], pc, rpc.user[`max${ability}`])
                rpc.altered = true
            }
            const a = `to${titleCase(ability)}`
            let mod = rpc.user.blessed ? 10 : 0
            mod -= rpc.user.cursed ? 10 : 0
            //  iterate each ring, ability mods are additive
            rpc.user.rings.forEach(ring => {
                mod -= Ring.power(rpc.user.rings, [ring], 'degrade', 'ability', ability).power * 2
                mod -= Ring.power(rpc.user.rings, [ring], 'degrade', 'pc', rpc.user.pc).power * 3
                mod += Ring.power([], [ring], 'upgrade', 'ability', ability).power * PC.card(rpc.user.pc)[a] * 2
                mod += Ring.power([], [ring], 'upgrade', 'pc', rpc.user.pc).power * PC.card(rpc.user.pc)[a] * 3
            })
            if (rt > 100) {
                mod++
                rt %= 100
            }
            rpc[ability] = this.ability(rpc[ability], rt, rpc.user[`max${ability}`], mod)
        }

        card(dd = 'Spirit'): character {
            let rpc = <character>{}
            for (let type in this.name) {
                if (this.name[type][dd]) {
                    rpc = this.name[type][dd]
                    break
                }
            }
            return rpc
        }

        encounter(where = '', lo = 2, hi = 99): active {
            lo = lo < 2 ? 2 : lo > 99 ? 99 : lo
            hi = hi < 2 ? 2 : hi > 99 ? 99 : hi

            let rpc = <active>{ user: { id: '' } }
            let rs = query(`SELECT id FROM Players WHERE id != '${player.id}'
            AND xplevel BETWEEN ${lo} AND ${hi}
            AND status != 'jail'
            ${where} ORDER BY level`)
            if (rs.length) {
                let n = dice(rs.length) - 1
                rpc.user.id = rs[n].id
                loadUser(rpc)
            }
            return rpc
        }

        hp(user = player): number {
            return Math.round(user.level + dice(user.level) + user.str / 10)
        }

        jousting(rpc: active): number {
            return Math.round(rpc.dex * rpc.user.level / 10 + 2 * rpc.user.jw - rpc.user.jl + 10)
        }

        profile(rpc = online, effect = 'fadeInLeft', meta = '') {
            let userPNG = `door/static/images/user/${rpc.user.id}.png`
            try {
                fs.accessSync(userPNG, fs.constants.F_OK)
                userPNG = `user/${rpc.user.id}`
            } catch (e) {
                userPNG = (PC.name['player'][rpc.user.pc] || PC.name['immortal'][rpc.user.pc] ? 'player' : 'monster') + '/' + rpc.user.pc.toLowerCase() + (rpc.user.gender == 'F' ? '_f' : '')
            }
            Common.profile({ png: userPNG, handle: rpc.user.handle, level: rpc.user.level, pc: rpc.user.pc, effect: effect })
            Common.title(`${rpc.user.handle}: level ${rpc.user.level} ${rpc.user.pc} ${meta}`)
        }

        random(type?: string): string {
            let pc: string = ''
            if (type) {
                let i = dice(Object.keys(this.name[type]).length)
                let n = i
                for (let dd in this.name[type])
                    if (!--n) {
                        pc = dd
                        break
                    }
            }
            else {
                let i = dice(this.total - 2)    //  less Spirit and Novice
                let n = i + 2
                for (type in this.name) {
                    for (let dd in this.name[type])
                        if (!--n) {
                            pc = dd
                            break
                        }
                    if (!n) break
                }
            }
            return pc
        }

        sp(user = player): number {
            return user.magic > 1 ? Math.round(user.level + dice(user.level) + user.int / 10) : 0
        }

        stats(profile: active) {
            Common.action('clear')
            this.profile(profile)

            const line = '------------------------------------------------------'
            const space = '                                                      '
            const sex = profile.user.sex == 'I' ? profile.user.gender : profile.user.sex
            var i: number
            var n: number

            i = 22 - profile.user.handle.length
            n = 11 + i / 2
            clear()
            xvt.out(xvt.blue, '+', xvt.faint, line.slice(0, n), xvt.normal, '=:))')
            xvt.out(xvt.Blue, xvt.yellow, xvt.bright, ' ', profile.user.handle, ' ', xvt.reset)
            n = 11 + i / 2 + i % 2
            xvt.outln(xvt.blue, '((:=', xvt.faint, line.slice(0, n), xvt.normal, '+')

            i = 30 - Access.name[profile.user.access][sex].length
            n = 11 + i / 2
            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.white, xvt.normal, space.slice(0, n))
            xvt.out('"', Access.name[profile.user.access][sex], '"')
            n = 11 + i / 2 + i % 2
            xvt.outln(xvt.blue, space.slice(0, n), xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out('    Title: ', xvt.white)
            if (player.emulation == 'XT') xvt.out('\r\x1B[2C', Access.name[profile.user.access].emoji, '\r\x1B[12C')
            xvt.out(sprintf('%-20s', profile.user.access))
            xvt.out(xvt.cyan, ' Born: ', xvt.white, date2full(profile.user.dob))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out('    Class: ', xvt.white)
            if (player.emulation == 'XT' && profile.user.wins > 0) xvt.out('\r\x1B[2C🎖️\r\x1B[12C')
            xvt.out(sprintf('%-21s', profile.user.pc + ' (' + profile.user.gender + ')'))
            xvt.out(xvt.cyan, ' Exp: ', xvt.white)
            if (profile.user.xp < 1e+8)
                xvt.out(sprintf('%-15f', profile.user.xp))
            else
                xvt.out(sprintf('%-15.7e', profile.user.xp))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out(' Immortal: ', xvt.white)
            xvt.out(sprintf('%-20s', (profile.user.wins ? `${romanize(profile.user.wins)}.` : '')
                + profile.user.immortal + '.' + profile.user.level + ` (${profile.user.calls})`))
            xvt.out(xvt.cyan, ' Need: ', xvt.white)
            if (experience(profile.user.level, undefined, profile.user.int) < 1e+8)
                xvt.out(sprintf('%-15f', experience(profile.user.level, undefined, profile.user.int)))
            else
                xvt.out(sprintf('%-15.7e', experience(profile.user.level, undefined, profile.user.int)))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out('      Str: ', xvt.white)
            if (player.emulation == 'XT') xvt.out('\r\x1B[2C💪\r\x1B[12C')
            xvt.out(sprintf('%-20s', profile.str + ' (' + profile.user.str + ',' + profile.user.maxstr + ')'))
            xvt.out(xvt.cyan, ' Hand: ', profile.user.coin.carry(), ' '.repeat(15 - profile.user.coin.amount.length))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out('      Int: ', xvt.white)
            xvt.out(sprintf('%-20s', profile.int + ' (' + profile.user.int + ',' + profile.user.maxint + ')'))
            xvt.out(xvt.cyan, ' Bank: ', profile.user.bank.carry(), ' '.repeat(15 - profile.user.bank.amount.length))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out('      Dex: ', xvt.white)
            xvt.out(sprintf('%-20s', profile.dex + ' (' + profile.user.dex + ',' + profile.user.maxdex + ')'))
            xvt.out(xvt.cyan, ' Loan: ', profile.user.loan.carry(), ' '.repeat(15 - profile.user.loan.amount.length))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out('      Cha: ', xvt.white)
            xvt.out(sprintf('%-19s', profile.cha + ' (' + profile.user.cha + ',' + profile.user.maxcha + ')'))
            xvt.out(xvt.faint, ' Steal: ', xvt.normal)
            xvt.out(sprintf('%-15s', ['lawful', 'desperate', 'trickster', 'adept', 'master'][profile.user.steal]))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            if (profile.user.blessed) {
                let who: user = { id: profile.user.blessed }
                if (!loadUser(who)) {
                    if (profile.user.blessed == 'well')
                        who.handle = 'a wishing well'
                    else
                        who.handle = profile.user.blessed
                }
                xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.yellow, xvt.bright)
                xvt.out(' +Blessed:', xvt.white, xvt.normal, ' by ', sprintf('%-39s', who.handle))
                xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')
            }

            if (profile.user.cursed) {
                let who: user = { id: profile.user.cursed }
                if (!loadUser(who)) {
                    if (profile.user.cursed == 'wiz!')
                        who.handle = 'a doppelganger!'
                    else
                        who.handle = profile.user.cursed
                }
                xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.white)
                xvt.out('  -Cursed:', xvt.normal, ' by ', sprintf('%-39s', who.handle))
                xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')
            }

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out('       HP: ', xvt.white)
            if (player.emulation == 'XT') xvt.out('\r\x1B[2C🌡️\r\x1B[12C')
            xvt.out(sprintf('%-42s', profile.hp + '/' + profile.user.hp + ' ('
                + ['weak', 'normal', 'adept', 'warrior', 'brute', 'hero'][profile.user.melee] + ', '
                + ['a rare', 'occasional', 'deliberate', 'angry', 'murderous'][profile.user.backstab] + ' backstab)'))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            if (profile.user.magic > 1) {
                xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.magenta, xvt.bright)
                xvt.out('       SP: ', xvt.white)
                xvt.out(sprintf('%-42s', profile.sp + '/' + profile.user.sp + ' (' + ['wizardry', 'arcane', 'divine'][profile.user.magic - 2] + ')'))
                xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')
            }

            if (profile.user.spells.length) {
                xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.magenta, xvt.bright)
                xvt.out(sprintf(' %8s: ', ['Wands', 'Wands', 'Scrolls', 'Spells', 'Magus'][profile.user.magic]), xvt.white)
                let text = ''
                n = 0
                for (let p = 0; p < profile.user.spells.length; p++) {
                    let spell = profile.user.spells[p]
                    let name = Magic.pick(spell)
                    if (spell < 5 || (spell < 17 && name.length > 7)) name = name.slice(0, 3)
                    if (text.length + name.length > 40) break
                    if (text.length) text += ','
                    text += name
                    n++
                }
                xvt.out(sprintf('%-42s', text))
                xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')
                while (n < profile.user.spells.length) {
                    text = ''
                    i = 0
                    xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.white, xvt.bright, '           ')
                    for (let p = 0; p < profile.user.spells.length; p++) {
                        i++
                        if (i > n) {
                            let spell = profile.user.spells[p]
                            let name = Magic.pick(spell)
                            if (spell < 17 && name.length > 7) name = name.slice(0, 3)
                            if (text.length + name.length > 40) break
                            if (text.length) text += ','
                            text += name
                            n++
                        }
                    }
                    xvt.out(sprintf('%-42s', text))
                    xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')
                }
            }

            if (profile.user.rings.length) {
                xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.magenta, xvt.bright)
                xvt.out('    Rings: ', xvt.white)
                if (player.emulation == 'XT') xvt.out('\r\x1B[2C💍\r\x1B[12C')
                let text = ''
                n = 0
                for (let p = 0; p < profile.user.rings.length; p++) {
                    let name = profile.user.rings[p]
                    if (text.length + name.length > 40) break
                    if (text.length) text += ','
                    text += name
                    n++
                }
                xvt.out(sprintf('%-42s', text))
                xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')
                while (n < profile.user.rings.length) {
                    text = ''
                    i = 0
                    xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.white, xvt.bright, '           ')
                    for (let p = 0; p < profile.user.rings.length; p++) {
                        i++
                        if (i > n) {
                            let name = profile.user.rings[p]
                            if (text.length + name.length > 40) break
                            if (text.length) text += ','
                            text += name
                            n++
                        }
                    }
                    xvt.out(sprintf('%-42s', text))
                    xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')
                }
            }

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.white)
            xvt.out('  Alchemy: ', xvt.normal)
            xvt.out(sprintf('%-42s', ['banned', 'apprentice', 'expert (+1x,+1x)', 'artisan (+1x,+2x)', 'master (+2x,+2x)'][profile.user.poison]))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            if (profile.user.poisons.length) {
                xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.white)
                xvt.out(sprintf(' %8s: ', ['Vial', 'Toxin', 'Poison', 'Bane', 'Venena'][profile.user.poison]), xvt.normal)
                if (player.emulation == 'XT') xvt.out('\r\x1B[2C🧪\r\x1B[12C')
                xvt.out(sprintf('%-42s', profile.user.poisons.toString()))
                xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')
            }

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out('   Weapon: ')
            if (player.emulation == 'XT') xvt.out('\r\x1B[2C🗡️\r\x1B[12C')
            xvt.out(this.weapon(profile), ' '.repeat(42 - this.weapon(profile, true).length))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out('    Armor: ')
            if (player.emulation == 'XT') xvt.out('\r\x1B[2C🛡\r\x1B[12C')
            xvt.out(this.armor(profile), ' '.repeat(42 - this.armor(profile, true).length))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out(' Lives in: ', xvt.white)
            xvt.out(sprintf('%-42s', profile.user.realestate + ' (' + profile.user.security + ')'))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            if (profile.user.gang) {
                xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
                xvt.out('    Party: ', xvt.white)
                if (player.emulation == 'XT') xvt.out('\r\x1B[2C🏴\r\x1B[12C')
                xvt.out(sprintf('%-42s', profile.user.gang))
                xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')
            }

            if (+profile.user.hull) {
                xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
                xvt.out('  Warship: ', xvt.white)
                xvt.out(sprintf('%-18s', profile.hull.toString() + ':' + profile.user.hull.toString()))
                xvt.out(xvt.cyan, ' Cannon: ', xvt.white)
                xvt.out(sprintf('%-15s', profile.user.cannon.toString() + ':' + (profile.user.hull / 50).toString() + (profile.user.ram ? ' (RAM)' : '')))
                xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')
            }

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out(' Brawling: ', xvt.white)
            xvt.out(sprintf('%-19s', profile.user.tw + ':' + profile.user.tl))
            xvt.out(xvt.cyan, 'Steals: ', xvt.white)
            xvt.out(sprintf('%-15s', profile.user.steals))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out(' Jousting: ', xvt.white)
            xvt.out(sprintf('%-20s', profile.user.jw + ':' + profile.user.jl + ` (${this.jousting(profile)})`))
            xvt.out(xvt.cyan, 'Plays: ', xvt.white)
            xvt.out(sprintf('%-15s', profile.user.plays))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.out(xvt.blue, xvt.faint, '|', xvt.Blue, xvt.cyan, xvt.bright)
            xvt.out('    Kills: ', xvt.white)
            if (player.emulation == 'XT') xvt.out('\r\x1B[2C💀\r\x1B[12C')
            xvt.out(sprintf('%-42s', profile.user.kills + ' with ' + profile.user.retreats + ' retreats and killed ' + profile.user.killed + 'x'))
            xvt.outln(' ', xvt.reset, xvt.blue, xvt.faint, '|')

            xvt.outln(xvt.blue, '+', xvt.faint, line, xvt.normal, '+')
        }

        armor(profile = online, text = false): string {
            return text ? profile.user.armor + buff(profile.user.toAC, profile.toAC, true)
                : xvt.attr(profile.armor.armoury ? xvt.white : profile.armor.dwarf ? xvt.yellow : xvt.lcyan
                    , profile.user.armor, xvt.white, buff(profile.user.toAC, profile.toAC))
        }

        weapon(profile = online, text = false): string {
            return text ? profile.user.weapon + buff(profile.user.toWC, profile.toWC, true)
                : xvt.attr(profile.weapon.shoppe ? xvt.white : profile.weapon.dwarf ? xvt.yellow : xvt.lcyan
                    , profile.user.weapon, xvt.white, buff(profile.user.toWC, profile.toWC))
        }

        rings(profile = online) {
            for (let i in profile.user.rings) {
                let ring = profile.user.rings[i]
                xvt.out(xvt.cyan, player.emulation == 'XT' ? '⍤' : xvt.app.Empty, ' ', xvt.bright, ring, xvt.normal, ' ')
                if (player.emulation == 'XT') xvt.out(Ring.name[ring].emoji, '💍')
                xvt.outln('ring:', xvt.reset, ' can ', Ring.name[ring].description, -100)
            }
        }

        wearing(profile: active) {
            if (isNaN(+profile.user.weapon)) {
                xvt.outln('\n', this.who(profile).He, profile.weapon.text, ' ', this.weapon(profile)
                    , from == 'Dungeon' ? -300 : !profile.weapon.shoppe ? -500 : -100)
            }
            if (isNaN(+profile.user.armor)) {
                xvt.outln('\n', this.who(profile).He, profile.armor.text, ' ', this.armor(profile)
                    , from == 'Dungeon' ? -300 : !profile.armor.armoury ? -500 : -100)
            }
            if (!player.novice && from !== 'Dungeon' && profile.user.sex == 'I') for (let i in profile.user.rings) {
                let ring = profile.user.rings[i]
                if (!+i) xvt.outln()
                xvt.out(this.who(profile).He, 'has ', xvt.cyan, xvt.bright, ring, xvt.normal)
                if (player.emulation == 'XT') xvt.out(' ', Ring.name[ring].emoji)
                xvt.outln(' powers ', xvt.reset, 'that can ', Ring.name[ring].description, -100)
            }
        }

        who(pc: active | user, mob = false): who {
            let user: user = isActive(pc) ? pc.user : pc
            const gender = pc === online ? 'U' : user.gender
            const Handle = `${gender == 'I' && from !== 'Party' ? 'The ' : ''}${user.handle}`
            const handle = `${gender == 'I' && from !== 'Party' ? 'the ' : ''}${user.handle}`
            //  if there are multiple PCs engaged on a side (mob), replace pronouns for clarification
            return {
                He: `${{ M: mob ? Handle : 'He', F: mob ? Handle : 'She', I: mob ? Handle : 'It', U: 'You' }[gender]} `,
                he: `${{ M: 'he', F: 'she', I: 'it', U: 'you' }[gender]} `,
                him: `${{ M: mob ? handle : 'him', F: mob ? handle : 'her', I: mob ? handle : 'it', U: 'you' }[gender]} `,
                His: `${{
                    M: mob ? Handle + `'` + (Handle.substr(-1) !== 's' ? 's' : '') : 'His'
                    , F: mob ? Handle + `'` + (Handle.substr(-1) !== 's' ? 's' : '') : 'Her'
                    , I: mob ? Handle + `'` + (Handle.substr(-1) !== 's' ? 's' : '') : 'Its', U: 'Your'
                }[gender]} `,
                his: `${{
                    M: mob ? handle + `'` + (handle.substr(-1) !== 's' ? 's' : '') : 'his'
                    , F: mob ? handle + `'` + (handle.substr(-1) !== 's' ? 's' : '') : 'her'
                    , I: mob ? handle + `'` + (handle.substr(-1) !== 's' ? 's' : '') : 'its', U: 'your'
                }[gender]} `,
                self: `${{ M: 'him', F: 'her', I: 'it', U: 'your' }[gender]}self `,
                You: `${{ M: Handle, F: Handle, I: Handle, U: 'You' }[gender]} `,
                you: `${{ M: handle, F: handle, I: handle, U: 'you' }[gender]}`
            }
        }
    }

    export const PC = new Character()

    export class coins {
        constructor(money: string | number) {
            if (typeof money == 'number') {
                this.value = money
            }
            else {
                this.amount = money
            }
        }

        _value: number

        get value(): number {
            return this._value
        }

        set value(newValue: number) {
            const MAX = (1e+18 - 1e+09)
            this._value = newValue < MAX ? newValue
                : newValue == Infinity ? 1 : MAX
        }

        //  top valued coin bag (+ a lesser)
        get amount(): string {
            return this.carry(2, true)
        }

        set amount(newAmount: string) {
            this.value = 0
            let coins = 0

            for (var i = 0; i < newAmount.length; i++) {
                let c = newAmount.charAt(i)
                switch (c) {
                    case 'c':
                        coins *= 1
                        break
                    case 's':
                        coins *= 1e+05
                        break
                    case 'g':
                        coins *= 1e+09
                        break
                    case 'p':
                        coins *= 1e+13
                        break
                }
                if (c >= '0' && c <= '9') {
                    coins *= 10
                    coins += +c
                }
                else {
                    this.value += coins
                    coins = 0
                }
            }
        }

        carry(max = 2, text = false): string {
            let n = this.value
            let bags: string[] = []

            if (this.pouch(n) == 'p') {
                n = int(n / 1e+13)
                bags.push(text ? n + 'p' : xvt.attr(xvt.white, xvt.bright, n.toString(), xvt.magenta, 'p', xvt.normal, xvt.white))
                n = this.value % 1e+13
            }
            if (this.pouch(n) == 'g') {
                n = int(n / 1e+09)
                bags.push(text ? n + 'g' : xvt.attr(xvt.white, xvt.bright, n.toString(), xvt.yellow, 'g', xvt.normal, xvt.white))
                n = this.value % 1e+09
            }
            if (this.pouch(n) == 's') {
                n = int(n / 1e+05)
                bags.push(text ? n + 's' : xvt.attr(xvt.white, xvt.bright, n.toString(), xvt.cyan, 's', xvt.normal, xvt.white))
                n = this.value % 1e+05
            }
            if ((n > 0 && this.pouch(n) == 'c') || bags.length == 0)
                bags.push(text ? n + 'c' : xvt.attr(xvt.white, xvt.bright, n.toString(), xvt.red, 'c', xvt.normal, xvt.white))

            return bags.slice(0, max).toString()
        }

        pieces(p = this.pouch(this.value)): string {
            return 'pouch of '
                + (player.emulation == 'XT' ? '💰 ' : '')
                + {
                    'p': xvt.attr(xvt.magenta, xvt.bright, 'platinum', xvt.normal),
                    'g': xvt.attr(xvt.yellow, xvt.bright, 'gold', xvt.normal),
                    's': xvt.attr(xvt.cyan, xvt.bright, 'silver', xvt.normal),
                    'c': xvt.attr(xvt.red, xvt.bright, 'copper', xvt.normal)
                }[p]
                + xvt.attr(' pieces', xvt.reset)
        }

        pouch(coins: number): string {
            if (coins < 1e+05)
                return 'c'
            if (coins < 1e+09)
                return 's'
            if (coins < 1e+13)
                return 'g'
            return 'p'
        }
    }

    export function activate(one: active, keep = false, confused = false): boolean {
        one.adept = one.user.wins ? 1 : 0
        one.pc = PC.card(one.user.pc)
        one.str = one.user.str
        one.int = one.user.int
        one.dex = one.user.dex
        one.cha = one.user.cha
        Abilities.forEach(ability => {
            const a = `to${titleCase(ability)}`
            let rt = one.user.blessed ? 10 : 0
            rt -= one.user.cursed ? 10 : 0
            //  iterate each ring, ability runtimes are additive
            one.user.rings.forEach(ring => {
                rt -= Ring.power(one.user.rings, [ring], 'degrade', 'ability', ability).power * 2
                rt -= Ring.power(one.user.rings, [ring], 'degrade', 'pc', one.user.pc).power * 3
                rt += Ring.power([], [ring], 'upgrade', 'ability', ability).power * PC.card(one.user.pc)[a] * 2
                rt += Ring.power([], [ring], 'upgrade', 'pc', one.user.pc).power * PC.card(one.user.pc)[a] * 3
            })
            PC.adjust(ability, rt, 0, 0, one)
        })
        one.confused = false
        if (confused) return true

        one.who = PC.who(one)
        one.altered = true
        one.hp = one.user.hp
        one.sp = one.user.sp
        one.bp = int(one.user.hp / 10)
        one.hull = one.user.hull
        Weapon.equip(one, one.user.weapon, true)
        Armor.equip(one, one.user.armor, true)
        if (!isDefined(one.user.access))
            one.user.access = Object.keys(Access.name)[0]

        if (keep) {
            if (!lock(one.user.id, one.user.id == player.id ? 1 : 2) && one.user.id !== player.id) {
                xvt.beep()
                xvt.outln('\n', xvt.cyan, xvt.bright, one.user.handle, ' is engaged elsewhere.', -500)
                return false
            }
        }
        return true
    }

    export function checkTime(): number {
        return Math.round((xvt.sessionAllowed - ((new Date().getTime() - xvt.sessionStart.getTime()) / 1000)) / 60)
    }

    export function checkXP(rpc: active, cb: Function): boolean {

        jumped = 0

        let t = checkTime()
        if (t !== timeleft) {
            timeleft = t
            if (timeleft < 0) {
                reason = 'got exhausted'
            }
            else if (timeleft <= warning) {
                warning = timeleft
                beep()
                xvt.outln(xvt.bright, `\n *** `, xvt.faint, `${warning}-minute${warning !== 1 ? 's' : ''} remain${warning == 1 ? 's' : ''}`, xvt.bright, ` *** `)
                sound('hurry')
            }
        }

        if (!Access.name[rpc.user.access].roleplay) return false
        if (rpc.user.level >= sysop.level) {
            riddle()
            return true
        }

        if (rpc.user.xp < experience(rpc.user.level, 1, rpc.user.int)) {
            rpc.user.xplevel = rpc.user.level
            return false
        }

        reason = ''
        xvt.drain()

        let award = {
            hp: rpc.user.hp,
            sp: rpc.user.sp,
            str: rpc.user.str,
            int: rpc.user.int,
            dex: rpc.user.dex,
            cha: rpc.user.cha
        }
        let eligible = rpc.user.level < sysop.level / 2
        let bonus = false
        let started = rpc.user.xplevel || rpc.user.level

        while (rpc.user.xp >= experience(rpc.user.level, undefined, rpc.user.int) && rpc.user.level < sysop.level) {
            rpc.user.level++

            if (rpc.user.level == Access.name[rpc.user.access].promote) {
                music('promote')
                let title = Object.keys(Access.name).indexOf(rpc.user.access)
                do {
                    rpc.user.access = Object.keys(Access.name)[++title]
                } while (!isDefined(Access.name[rpc.user.access][rpc.user.sex]))
                xvt.outln(-500)
                xvt.outln(xvt.yellow
                    , Access.name[king.access][king.sex], ' the ', king.access.toLowerCase()
                    , ', ', xvt.bright, king.handle, xvt.normal
                    , ', is pleased with your accomplishments\n'
                    , `and ${PC.who(king).he}promotes you to`, xvt.bright, an(rpc.user.access), xvt.normal, '!', -2000)
                if (Access.name[rpc.user.access].message)
                    xvt.outln(xvt.yellow, `${PC.who(king).He}whispers, `, xvt.reset, xvt.faint, `"${eval('`' + Access.name[rpc.user.access].message + '`')}"`, -2000)
                let nme = PC.encounter(`AND id NOT GLOB '_*' AND id != '${king.id}'`)
                xvt.outln(`The mob goes crazy`, -500, nme.user.id
                    ? `, except for ${nme.user.handle} seen buffing ${nme.who.his}${PC.weapon(nme)}`
                    : `!!`, -2000)
                xvt.outln([`${taxman.user.handle} nods an approval.`, `${barkeep.user.handle} slaughters a pig for tonight's feast.`, `${king.handle} gives you a hug.`, `${Access.name[king.access][king.sex]}'s guard salute you.`, `${king.handle} orders ${PC.who(king).his} Executioner to hang ${player.level} prisoners in your honor.`][dice(5) - 1], -2000)
                news(`\tpromoted to ${rpc.user.access}`)
                wall(`promoted to ${rpc.user.access}`)
                xvt.sessionAllowed += 300
            }

            rpc.user.hp += PC.hp(rpc.user)
            rpc.user.sp += PC.sp(rpc.user)

            PC.adjust('str', 0, PC.card(rpc.user.pc).toStr, 0, rpc)
            PC.adjust('int', 0, PC.card(rpc.user.pc).toInt, 0, rpc)
            PC.adjust('dex', 0, PC.card(rpc.user.pc).toDex, 0, rpc)
            PC.adjust('cha', 0, PC.card(rpc.user.pc).toCha, 0, rpc)

            if (eligible && rpc.user.level == 50) {
                bonus = true
                music('.')
                if (rpc.user.novice) {
                    reroll(rpc.user, sysop.pc, rpc.user.level)
                    rpc.user.novice = false
                    rpc.user.expert = true
                    xvt.outln(xvt.cyan, xvt.bright, 'You are no longer a novice.  Welcome to the next level of play!')
                    sound('welcome', 9)
                    xvt.outln('You morph into', xvt.yellow, an(rpc.user.pc), xvt.reset, '.', -250)
                    PC.profile()
                    sound('cheer', 21)
                }
                sound('demon', 17)
                break
            }
        }

        jumped = rpc.user.level - started
        award.hp = rpc.user.hp - award.hp
        award.sp = rpc.user.sp - award.sp
        rpc.hp += award.hp
        rpc.sp += award.sp

        if ((award.str = rpc.user.str - award.str) < 1) award.str = 0
        if ((award.int = rpc.user.int - award.int) < 1) award.int = 0
        if ((award.dex = rpc.user.dex - award.dex) < 1) award.dex = 0
        if ((award.cha = rpc.user.cha - award.cha) < 1) award.cha = 0

        PC.adjust('str', (award.str < 1) ? jumped : award.str, 0, 0, rpc)
        PC.adjust('int', (award.int < 1) ? jumped : award.int, 0, 0, rpc)
        PC.adjust('dex', (award.dex < 1) ? jumped : award.dex, 0, 0, rpc)
        PC.adjust('cha', (award.cha < 1) ? jumped : award.cha, 0, 0, rpc)

        if (rpc != online) return false

        sound('level')
        access = Access.name[player.access]
        online.altered = true
        xvt.outln(-125)
        xvt.outln('      ', xvt.magenta, '-=', xvt.blue, '>', xvt.bright, xvt.yellow, '*', xvt.normal
            , xvt.blue, '<', xvt.magenta, '=-', -125)
        xvt.outln(-125)
        xvt.outln(xvt.bright, xvt.yellow, 'Welcome to level ', player.level.toString(), '!', -125)
        xvt.outln(-125)
        wall(`is now a level ${player.level} ${player.pc}`)

        let deed = mydeeds.find((x) => { return x.deed == 'levels' })
        if (!player.novice && !deed) deed = mydeeds[mydeeds.push(loadDeed(player.pc, 'levels')[0]) - 1]
        if ((deed && jumped >= deed.value)) {
            deed.value = jumped
            xvt.outln(xvt.cyan, ' + ', xvt.bright, Deed.name[deed.deed].description, ' ', bracket(deed.value, false))
            beep()
            saveDeed(deed)
        }

        if (player.level < sysop.level) {
            xvt.outln(xvt.bright, sprintf('%+6d', award.hp), xvt.reset, ' Hit points', -100)
            if (award.sp)
                xvt.outln(xvt.bright, sprintf('%+6d', award.sp), xvt.reset, ' Spell points', -100)
            if (award.str)
                xvt.outln(xvt.bright, sprintf('%+6d', award.str), xvt.reset, ' Strength', -100)
            if (award.int)
                xvt.outln(xvt.bright, sprintf('%+6d', award.int), xvt.reset, ' Intellect', -100)
            if (award.dex)
                xvt.outln(xvt.bright, sprintf('%+6d', award.dex), xvt.reset, ' Dexterity', -100)
            if (award.cha)
                xvt.outln(xvt.bright, sprintf('%+6d', award.cha), xvt.reset, ' Charisma', -100)
            if (eligible && bonus) {
                skillplus(rpc, cb)
                return true
            }
            player.xplevel = player.level
        }
        else {
            riddle()
            return true
        }

        return false
    }

    export function skillplus(rpc: active, cb: Function) {

        PC.profile(online)
        rpc.user.expert = true

        //  slow-roll endowment choices for a dramatic effect  :)
        xvt.outln(-500)
        let hero = ` ${player.emulation == 'XT' ? PC.card(player.pc).unicode : '+'} `
        xvt.outln(xvt.bright, xvt.yellow, hero, xvt.normal, 'You earn a gift to endow your '
            , xvt.faint, rpc.user.pc, xvt.normal, ' character', xvt.bright, hero, -1000)
        xvt.outln(-500)
        xvt.drain()

        if (rpc.user.maxstr < 97 || rpc.user.maxint < 97 || rpc.user.maxdex < 97 || rpc.user.maxcha < 97)
            xvt.outln(bracket(0, false), xvt.yellow, ' Increase ALL abilities by ', xvt.reset, '+3', -125)
        xvt.outln(bracket(1, false), xvt.yellow, ' Increase Strength ability from ', xvt.reset
            , rpc.user.maxstr.toString(), ' '
            , rpc.user.maxstr < 90 ? '[WEAK]'
                : rpc.user.maxstr < 95 ? '-Average-'
                    : rpc.user.maxstr < 99 ? '=Strong='
                        : '#MAX#'
            , -125)
        xvt.outln(bracket(2, false), xvt.yellow, ' Increase Intellect ability from ', xvt.reset
            , rpc.user.maxint.toString(), ' '
            , rpc.user.maxint < 90 ? '[MORON]'
                : rpc.user.maxint < 95 ? '-Average-'
                    : rpc.user.maxint < 99 ? '=Smart='
                        : '#MAX#'
            , -125)
        xvt.outln(bracket(3, false), xvt.yellow, ' Increase Dexterity ability from ', xvt.reset
            , rpc.user.maxdex.toString(), ' '
            , rpc.user.maxdex < 90 ? '[SLOW]'
                : rpc.user.maxdex < 95 ? '-Average-'
                    : rpc.user.maxdex < 99 ? '=Swift='
                        : '#MAX#'
            , -125)
        xvt.outln(bracket(4, false), xvt.yellow, ' Increase Charisma ability from ', xvt.reset
            , rpc.user.maxcha.toString(), ' '
            , rpc.user.maxcha < 90 ? '[SURLY]'
                : rpc.user.maxcha < 95 ? '-Average-'
                    : rpc.user.maxcha < 99 ? '=Affable='
                        : '#MAX#'
            , -125)
        xvt.outln(bracket(5, false), xvt.yellow, ' Improve Melee skill from ', xvt.reset
            , rpc.user.melee.toString(), 'x '
            , ['[POOR]', '-Average-', '+Good+', '=Masterful=', '#MAX#'][rpc.user.melee]
            , -125)
        xvt.outln(bracket(6, false), xvt.yellow, ' Improve Backstab skill from ', xvt.reset
            , rpc.user.backstab.toString(), 'x '
            , ['[RARE]', '-Average-', '+Good+', '=Masterful=', '#MAX#'][rpc.user.backstab]
            , -125)
        xvt.outln(bracket(7, false), xvt.yellow, ' Improve Poison skill from ', xvt.reset
            , rpc.user.poison.toString(), 'x '
            , ['[BAN]', '-Average-', '+Good+', '=Masterful=', '#MAX#'][rpc.user.poison]
            , -125)
        if (rpc.user.magic < 2) {
            xvt.out(bracket(8, false), xvt.yellow, ' Improve Magic skill from ', xvt.reset)
            xvt.out(['[BAN]', '-Wands-'][rpc.user.magic])
        }
        else {
            xvt.out(bracket(8, false), xvt.yellow, ' Increase Mana power for ', xvt.reset)
            xvt.out(['+Scrolls+', '=Spells=', '#MAX#'][rpc.user.magic - 2])
        }
        xvt.outln(-125)
        xvt.outln(bracket(9, false), xvt.yellow, ' Improve Stealing skill from ', xvt.reset
            , rpc.user.steal.toString(), 'x '
            , ['[RARE]', '-Average-', '+Good+', '=Masterful=', '#MAX#'][rpc.user.steal]
            , -125)

        action('list')

        xvt.app.form = {
            'skill': {
                cb: () => {
                    xvt.out('\n', xvt.bright)
                    switch (+xvt.entry) {
                        case 0:
                            news('\tgot generally better')
                            PC.adjust('str', 3, 3, 3)
                            PC.adjust('int', 3, 3, 3)
                            PC.adjust('dex', 3, 3, 3)
                            PC.adjust('cha', 3, 3, 3)
                            break

                        case 1:
                            news('\tcan get even Stronger')
                            if ((player.maxstr += 10) > 100) player.maxstr = 100
                            xvt.out(xvt.red, `Maximum Strength is now ${player.maxstr}.`)
                            break

                        case 2:
                            news('\tcan get even Wiser')
                            if ((player.maxint += 10) > 100) player.maxint = 100
                            xvt.out(xvt.green, `Maximum Intellect is now ${player.maxint}.`)
                            break

                        case 3:
                            news('\tcan get even Quicker')
                            if ((player.maxdex += 10) > 100) player.maxdex = 100
                            xvt.out(xvt.magenta, `Maximum Dexterity is now ${player.maxdex}.`)
                            break

                        case 4:
                            news('\tcan get even Nicer')
                            if ((player.maxcha += 10) > 100) player.maxcha = 100
                            xvt.out(xvt.yellow, `Maximum Charisma is now ${player.maxcha}.`)
                            break

                        case 5:
                            if (player.melee > 3) {
                                xvt.app.refocus()
                                return
                            }
                            news('\tgot Milk')
                            xvt.out([xvt.cyan, xvt.blue, xvt.red, xvt.yellow][player.melee]
                                , ['You can finally enter the Tavern without fear.'
                                    , 'So you want to be a hero, eh?'
                                    , 'Just what this world needs, another fighter.'
                                    , 'Watch out for blasts, you brute!'][player.melee++]
                            )
                            break

                        case 6:
                            if (player.backstab > 3) {
                                xvt.app.refocus()
                                return
                            }
                            news('\twatch your Back now')
                            xvt.out([xvt.cyan, xvt.blue, xvt.red, xvt.black][player.backstab]
                                , ['A backstab is in your future.'
                                    , 'You may backstab more regularly now.'
                                    , 'You will deal a more significant, first blow.'
                                    , 'What were you doing?  Sneaking.'][player.backstab++]
                            )
                            break

                        case 7:
                            if (player.poison > 3) {
                                xvt.app.refocus()
                                return
                            }
                            news('\tApothecary visits have more meaning')
                            xvt.out([xvt.green, xvt.cyan, xvt.red, xvt.magenta][player.poison]
                                , ['The Apothecary will sell you toxins now, bring money.'
                                    , 'Your poisons can achieve (+1x,+1x) potency now.'
                                    , 'Your banes will add (+1x,+2x) potency now.'
                                    , 'Your venena now makes for (+2x,+2x) potency!'][player.poison++]
                            )
                            break

                        case 8:
                            if (player.magic > 3) {
                                xvt.app.refocus()
                                return
                            }
                            news('\tbecame more friendly with the old mage')
                            switch (player.magic) {
                                case 0:
                                    xvt.out(xvt.cyan, 'The old mage will see you now, bring money.')
                                    player.magic++
                                    player.spells = []
                                    break
                                case 1:
                                    xvt.out(xvt.cyan, 'You can no longer use wands.')
                                    player.magic++
                                    player.spells = []
                                    player.sp += 15 + dice(511)
                                    online.sp = player.sp
                                    break
                                default:
                                    xvt.out(xvt.black, 'More mana is better')
                                    player.sp += 511
                                    online.sp += dice(511)
                                    break
                            }
                            break

                        case 9:
                            if (player.steal > 3) {
                                xvt.app.refocus()
                                return
                            }
                            news('\ttry to avoid in the Square')
                            xvt.out([xvt.cyan, xvt.blue, xvt.red, xvt.black][player.steal]
                                , ['Your fingers are starting to itch.'
                                    , 'Your eyes widen at the chance for unearned loot.'
                                    , 'Welcome to the Thieves guild: go pick a pocket or two!'
                                    , `You're convinced that no lock can't be picked.`][player.steal++]
                            )
                            break

                        default:
                            xvt.app.refocus()
                            return
                    }

                    online.altered = true
                    xvt.outln(-2000)
                    cb()
                }, prompt: 'Choose which: ', cancel: '0', min: 1, max: 1, match: /^[0-9]/
            }
        }
        xvt.drain()
        xvt.app.focus = 'skill'
    }

    export function an(item: string, show = true) {
        return ' ' + (/a|e|i|o|u/i.test(item[0]) ? 'an' : 'a') + ' ' + (show ? item : '')
    }

    export function cuss(text: string): boolean {
        let words = titlecase(text).split(' ')

        for (var i = 0; i < words.length; i++) {
            if (words[i].match('/^Asshole$|^Cock$|^Cunt$|^Fck$|^Fu$|^Fuc$|^Fuck$|^Fuk$|^Phuc$|^Phuck$|^Phuk$|^Twat$/')) {
                reason = 'needs a timeout'
                return true
            }
        }
        return false
    }

    const day: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const md: number[] = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    const mon: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    export function date2days(date: string): number {
        var days: number
        var month: number
        var day: number
        var year: number


        if (date.search('/') > 0) {
            let pieces = date.split('/')
            month = +pieces[0]
            day = +pieces[1]
            year = +pieces[2]
        }
        else if (date.search('-') > 0) {
            let pieces = date.split('/')
            month = +pieces[0]
            day = +pieces[1]
            if (day == 0) {
                day = month
                for (month = 0; month < 12 && mon[month].toLowerCase() == pieces[1].substr(0, 3).toLowerCase(); month++) { }
                month++
            }
            year = +pieces[2]
        }
        else if (+date > 18991231) {
            year = +date.substr(0, 4)
            month = +date.substr(4, 2)
            day = +date.substr(6, 2)
        }
        else {
            month = +date.substr(0, 2)
            day = +date.substr(2, 2)
            year = +date.substr(4, 4)
        }

        month = (month < 1) ? 1 : (month > 12) ? 12 : month
        day = (day < 1) ? 1 : (day > 31) ? 31 : day
        year = (year < 100) ? year + 1900 : year

        if (isNaN(day) || isNaN(month) || isNaN(year))
            return NaN

        days = (year * 365) + Math.trunc(year / 4) + md[month - 1] + (day - 1)
        if ((((year % 4) == 0) && (((year % 100) != 0) || ((year % 400) == 0))) && (month < 3))
            days--

        return days
    }

    //  returns 'Day dd-Mon-yyyy'
    export function date2full(days: number): string {
        var date = date2str(days)
        return sprintf('%.3s %.2s-%.3s-%.4s', day[(days - 1) % 7], date.substr(6, 2), mon[+date.substr(4, 2) - 1], date)
    }

    //  returns 'yyyymmdd'
    export function date2str(days: number): string {
        var month: number
        var day: number
        var year: number

        year = Math.trunc(days / 1461) * 4 + Math.trunc((days % 1461) / 365)
        days = days - ((year * 365) + Math.trunc(year / 4)) + 1
        month = 0

        while (days > md[month + 1] - ((((year % 4) == 0) && (((year % 100) != 0) || ((year % 400) == 0))) && month == 0 ? 1 : 0) && month < 11)
            month++

        days -= md[month++]
        day = days
        if ((((year % 4) == 0) && (((year % 100) != 0) || ((year % 400) == 0))) && month < 3)
            day++

        return sprintf('%04d%02d%02d', year, month, day)
    }

    export function dice(faces: number): number {
        return int(Math.random() * int(faces, true)) + 1
    }

    export function experience(level: number, factor = 1, wisdom = player.int): number {
        if (level < 1) return 0
        // calculate need to accrue based off PC intellect capacity
        if (wisdom < 1000) wisdom = (1100 + level - 2 * wisdom)

        return factor == 1
            ? Math.round(wisdom * Math.pow(2, level - 1))
            : int(wisdom * Math.pow(2, level - 2) / factor)
    }

    export function expout(xp: number, awarded = true): string {
        const gain = int(100 * xp / (experience(player.level) - experience(player.level - 1)))
        let out = (xp < 1e+8 ? xp.toString() : sprintf('%.4e', xp)) + ' '
        if (awarded && gain && online.int >= 90) {
            out += xvt.attr(xvt.off, xvt.faint, '(', xvt.bright
                , gain < 4 ? xvt.black : gain < 10 ? xvt.red : gain < 40 ? xvt.yellow
                    : gain < 80 ? xvt.green : gain < 130 ? xvt.cyan : gain < 400 ? xvt.blue
                        : xvt.magenta, sprintf('%+d', gain)
                , xvt.normal, '%', xvt.faint, xvt.white, ') ', xvt.reset)
        }
        out += 'experience.'
        return out
    }

    export function keyhint(rpc = online, echo = true) {
        let i: number
        let open = []
        let slot: number

        for (let i in rpc.user.keyhints)
            if (+i < 12 && !rpc.user.keyhints[i]) open.push(i)
        if (open.length) {
            do {
                i = open[dice(open.length) - 1]
                slot = int(i / 3)
                let key = ['P', 'G', 'S', 'C'][dice(4) - 1]
                if (key !== rpc.user.keyseq[slot]) {
                    for (let n = 3 * slot; n < 3 * (slot + 1); n++)
                        if (key == rpc.user.keyhints[n])
                            key = ''
                    if (key) rpc.user.keyhints[i] = key
                }
            } while (!rpc.user.keyhints[i])

            if (rpc === online && echo)
                xvt.outln('Key #', xvt.bright, `${slot + 1}`, xvt.normal, ' is not ', Deed.key[player.keyhints[i]])
        }
        else
            xvt.outln(xvt.reset, 'There are no more key hints available to you.')

        rpc.altered = true
    }

    //  normalize as an integer, optional as a whole number (non-negative)
    export function int(n: string | number, whole = false): number {
        n = (+n).valueOf()
        if (isNaN(n)) n = 0
        n = Math.trunc(n)   //  strip any fractional part
        if (n == 0) n = 0   //  strip any negative sign (really)
        return (whole && n < 0) ? 0 : n
    }

    export function log(who: string, message: string) {
        const folder = './files/user'
        if (!fs.existsSync(folder))
            fs.mkdirSync(folder)
        const log = `${folder}/${who}.txt`

        if (who.length && who[0] !== '_' && who !== player.id)
            fs.appendFileSync(log, `${message}\n`)
    }

    export function money(level: number): number {
        return int(Math.pow(2, (level - 1) / 2) * 10 * (101 - level) / 100)
    }

    export function news(message: string, commit = false) {

        const folder = './files/tavern'
        if (!fs.existsSync(folder))
            fs.mkdirSync(folder)
        const log = `${folder}/${player.id}.log`

        if (access.roleplay) {
            fs.appendFileSync(log, `${message}\n`)
            if (message && commit) {
                const paper = `./files/tavern/today.txt`
                fs.appendFileSync(paper, fs.readFileSync(log))
            }
        }
        if (commit)
            fs.unlink(log, () => { })
    }

    export function now(): { date: number, time: number } {
        let today = date2days(new Date().toLocaleString('en-US').split(',')[0])
        let now = new Date().toTimeString().slice(0, 5).replace(/:/g, '')
        return { date: +today, time: +now }
    }

    export function newkeys(user: user) {
        let keys = ['P', 'G', 'S', 'C']
        let prior = user.keyhints || []
        user.keyhints = ['', '', '', '', '', '', '', '', '', '', '', '', ...prior.slice(12)]
        user.keyseq = ''
        while (keys.length) {
            let k = dice(keys.length)
            user.keyseq += keys.splice(k - 1, 1)
        }
    }

    export function playerPC(points = 200, immortal = false) {

        music('reroll')
        if (points > 240) points = 240
        xvt.outln(-1000)
        if (!Access.name[player.access].roleplay) return

        if (player.novice) {
            let novice = <user>{ novice: true }
            Object.assign(novice, JSON.parse(fs.readFileSync(`${users}/novice.json`).toString()))
            reroll(player, novice.pc)
            Object.assign(player, novice)
            player.coin = new coins(novice.coin.toString())
            player.bank = new coins(novice.bank.toString())
            newkeys(player)

            xvt.outln('Since you are a new user here, you are automatically assigned a character')
            xvt.out('class.  At the Main Menu, press ', bracket('Y', false), ' to see all your character information.')
            show()
            activate(online)
            news(`Welcome a new player, ${player.handle}`)
            require('./tty/main').menu(true)
            return
        }
        else {
            xvt.sessionAllowed += 300
            warning = 2
        }

        action('list')
        xvt.app.form = {
            'pc': { cb: pick, min: 1, max: 2, cancel: '!' },
            'str': { cb: ability, min: 2, max: 2, match: /^[2-8][0-9]$/ },
            'int': { cb: ability, min: 2, max: 2, match: /^[2-8][0-9]$/ },
            'dex': { cb: ability, min: 2, max: 2, match: /^[2-8][0-9]$/ },
            'cha': { cb: ability, min: 2, max: 2, match: /^[2-8][0-9]$/ }
        }
        let a = { str: 20, int: 20, dex: 20, cha: 20 }

        if (immortal) {
            show()
            ability('str')
            return
        }

        profile({ jpg: 'classes', handle: 'Reroll!', effect: 'tada' })
        xvt.outln(player.pc, ', you have been rerolled.  You must pick a class.\n', -1500)

        xvt.outln(xvt.cyan, '      Character                       ', xvt.faint, '>> ', xvt.normal, 'Ability bonus')
        xvt.outln(xvt.cyan, '        Class      Users  Difficulty  Str  Int  Dex  Cha     Notable Feature')
        xvt.out(xvt.faint, xvt.cyan, '      ---------     ---   ----------  ---  ---  ---  ---  ---------------------')

        let classes = ['']
        let n = 0
        for (let pc in PC.name['player']) {
            let rpc = PC.card(pc)
            if (++n > 2) {
                if (player.keyhints.indexOf(pc, 12) < 0) {
                    xvt.out(bracket(classes.length))
                    classes.push(pc)
                }
                else {
                    const framed = n < 12
                        ? xvt.attr(xvt.faint, ' <', xvt.red, 'x')
                        : xvt.attr(xvt.faint, '<', xvt.red, 'xx')
                    xvt.out('\n', framed, xvt.white, '> ')
                }

                let rs = query(`SELECT COUNT(id) AS n FROM Players WHERE pc='${pc}' and id NOT GLOB '_*'`)[0]

                xvt.out(sprintf(' %-9s  %s  %3s    %-8s    +%s   +%s   +%s   +%s  %s'
                    , pc, player.emulation == 'XT' ? rpc.unicode : ' '
                    , +rs.n ? rs.n : xvt.attr(xvt.blue, '  ', xvt.app.Empty, xvt.white)
                    , rpc.difficulty
                    , xvt.attr([xvt.white, xvt.green, xvt.cyan, xvt.magenta][rpc.toStr - 1], rpc.toStr.toString(), xvt.white)
                    , xvt.attr([xvt.white, xvt.green, xvt.cyan, xvt.magenta][rpc.toInt - 1], rpc.toInt.toString(), xvt.white)
                    , xvt.attr([xvt.white, xvt.green, xvt.cyan, xvt.magenta][rpc.toDex - 1], rpc.toDex.toString(), xvt.white)
                    , xvt.attr([xvt.white, xvt.green, xvt.cyan, xvt.magenta][rpc.toCha - 1], rpc.toCha.toString(), xvt.white)
                    , rpc.specialty)
                )
            }
        }
        xvt.outln()

        xvt.app.form['pc'].prompt = `Enter class (1-${(classes.length - 1)}): `
        xvt.app.focus = 'pc'

        function show() {
            profile({
                png: 'player/' + player.pc.toLowerCase() + (player.gender == 'F' ? '_f' : '')
                , handle: player.handle, level: player.level, pc: player.pc, effect: 'zoomInDown'
            })
            xvt.outln()
            cat('player/' + player.pc.toLowerCase())
            let rpc = PC.card(player.pc)
            for (let l = 0; l < rpc.description.length; l++)
                xvt.outln(xvt.bright, xvt.cyan, rpc.description[l])
        }

        function pick() {
            let n: number = int(xvt.entry)
            if (n < 1 || n >= classes.length) {
                xvt.beep()
                xvt.app.refocus()
                return
            }
            reroll(player, classes[n])
            show()
            ability('str')
        }

        function ability(field?: string) {
            if (isNotEmpty(field)) {
                xvt.out('\n', xvt.yellow, 'You have ', xvt.bright, points.toString(), xvt.normal, ' points to distribute between 4 abilities: Strength, Intellect,\n')
                xvt.outln('Dexterity, Charisma.  Each ability must be between ', xvt.bright, '20', xvt.normal, ' and ', xvt.bright, '80', xvt.normal, ' points.')
                if (player.immortal < 3) {
                    xvt.outln('\nThis tracks how hard a character hits. Characters with higher Strength gain')
                    xvt.outln('more Hit Points when advancing in Experience Levels. More Strength yields more')
                    xvt.outln('damage in melee attacks.')
                }
                xvt.app.form[field].enter = player.str.toString()
                xvt.app.form[field].cancel = xvt.app.form[field].enter
                xvt.app.form[field].prompt = 'Enter your Strength  ' + bracket(player.str, false) + ': '
                xvt.app.focus = field
                return
            }

            let n: number = int(xvt.entry, true)
            if (n < 20 || n > 80) {
                xvt.beep()
                xvt.app.refocus()
                return
            }

            let left = points
            let p = xvt.app.focus

            switch (p) {
                case 'str':
                    left -= n
                    a.str = n

                    if (player.immortal < 3) {
                        xvt.outln('\n\nThis statistic comes into play mainly in casting and resisting magic. It is also')
                        xvt.outln(`calculated into approximating an opponent's Hit Points and ability to remember`)
                        xvt.outln('visited dungeon levels. Bonus Spell Power is awarded to those with a high')
                        xvt.out('Intellect upon gaining a level.')
                    }
                    p = 'int'
                    xvt.app.form[p].prompt = 'Enter your Intellect'
                    xvt.app.form[p].enter = player.int.toString()
                    xvt.app.form[p].cancel = xvt.app.form[p].enter
                    break

                case 'int':
                    left -= a.str + n
                    a.int = n

                    if (player.immortal < 3) {
                        xvt.outln('\n\nYour overall fighting ability is measured by how dexterous you are. It is used')
                        xvt.outln('to calculate who gets the first attack in a battle round, whether a hit was')
                        xvt.out('made, jousting ability, and in other applicable instances.')
                    }
                    p = 'dex'
                    xvt.app.form[p].prompt = 'Enter your Dexterity'
                    xvt.app.form[p].enter = player.dex.toString()
                    xvt.app.form[p].cancel = xvt.app.form[p].enter
                    break

                case 'dex':
                    left -= a.str + a.int + n
                    if (left < 20 || left > 80) {
                        xvt.beep()
                        xvt.outln()
                        reroll(player, player.pc)
                        ability('str')
                        return
                    }
                    a.dex = n

                    if (player.immortal < 3) {
                        xvt.outln('\n\nA high Charisma will get you more money when selling items in the Square and')
                        xvt.outln('from defeated foes. Some of the random events that occur tend to favor those')
                        xvt.out('with a high Charisma as well.')
                    }
                    p = 'cha'
                    xvt.app.form[p].prompt = 'Enter your Charisma '
                    xvt.app.form[p].enter = left.toString()
                    xvt.app.form[p].cancel = xvt.app.form[p].enter
                    break

                case 'cha':
                    left -= a.str + a.int + a.dex + n
                    if (left) {
                        xvt.beep()
                        reroll(player, player.pc)
                        ability('str')
                        return
                    }
                    a.cha = n

                    player.str = a.str
                    player.int = a.int
                    player.dex = a.dex
                    player.cha = a.cha
                    activate(online)

                    xvt.outln()
                    saveUser(player)
                    news(`\trerolled as${an(player.pc)}`)
                    if (immortal) {
                        reason = 'became immortal'
                        xvt.hangup()
                    }
                    else {
                        xvt.outln(xvt.yellow, `\n... and you get to complete any remaining parts to this play.`)
                        require('./tty/main').menu(true)
                    }
                    return
            }

            xvt.outln('\n\nYou have ', xvt.bright, left.toString(), xvt.normal, ' ability points left.')
            xvt.app.form[p].prompt += ' ' + bracket(xvt.app.form[p].enter, false) + ': '
            xvt.app.focus = p
        }
    }

    export function reroll(user: user, dd?: string, level = 1) {
        //  reset essential character attributes
        level = level > 99 ? 99 : level < 1 ? 1 : level
        user.level = level
        user.pc = dd ? dd : Object.keys(PC.name['player'])[0]
        user.status = ''

        let rpc = PC.card(user.pc)
        user.melee = rpc.melee
        user.backstab = rpc.backstab
        if (!(user.poison = rpc.poison)) user.poisons = []
        if (!(user.magic = rpc.magic)) user.spells = []
        user.steal = rpc.steal
        user.str = rpc.baseStr
        user.int = rpc.baseInt
        user.dex = rpc.baseDex
        user.cha = rpc.baseCha
        user.maxstr = rpc.maxStr
        user.maxint = rpc.maxInt
        user.maxdex = rpc.maxDex
        user.maxcha = rpc.maxCha
        user.xp = 0
        user.hp = 15
        user.sp = user.magic > 1 ? 15 : 0

        //  reset these prior experiences
        user.jl = 0
        user.jw = 0
        user.steals = 0
        user.tl = 0
        user.tw = 0

        //  reset for new or non player
        if (isEmpty(user.id) || user.id[0] == '_') {
            if (isNaN(user.dob)) user.dob = now().date
            if (isNaN(user.joined)) user.joined = now().date
            user.lastdate = now().date
            user.lasttime = now().time
            user.gender = user.sex || 'I'

            user.emulation = <EMULATION>xvt.app.emulation
            user.calls = 0
            user.today = 0
            user.expert = false
            user.rows = process.stdout.rows || 24
            user.remote = ''
            user.novice = isEmpty(user.id) && user.gender !== 'I'
            user.gang = user.gang || ''
            user.wins = 0
            user.immortal = 0

            user.coin = new coins(0)
            user.bank = new coins(0)
            user.loan = new coins(0)
            user.bounty = new coins(0)
            user.who = ''
            user.security = ''
            user.realestate = ''
            user.keyhints = []
        }

        if (level == 1) {
            Object.assign(user, JSON.parse(fs.readFileSync(`${users}/reroll.json`).toString()))
            user.gender = user.sex
            user.coin = new coins(user.coin.toString())
            user.bank = new coins(user.bank.toString())
            user.loan = new coins(0)
            //  force a verify if their access allows it
            // if (!user.novice && !Access.name[player.access].sysop) user.email = ''
        }

        if (level == 1 || isEmpty(user.id) || user.id[0] == '_') {
            //  no extra free or augmented stuff
            user.poisons = []
            user.spells = []
            if (user.rings) user.rings.forEach(ring => { saveRing(ring) })
            user.rings = []
            user.toAC = 0
            user.toWC = 0
            user.hull = 0
            user.cannon = 0
            user.ram = false
            user.blessed = ''
            user.cursed = ''
            user.coward = false
            user.plays = 0
            user.retreats = 0
            user.killed = 0
            user.kills = 0
            user.bounty = new coins(0)
            user.who = ''
        }

        if (user.level > 1) user.xp = experience(user.level - 1, 1, user.int)
        user.xplevel = (user.pc == Object.keys(PC.name['player'])[0]) ? 0 : user.level

        for (let n = 2; n <= level; n++) {
            user.level = n
            if (user.level == 50 && user.gender !== 'I' && user.id[0] !== '_' && !user.novice) {
                xvt.out(xvt.reset, xvt.bright, xvt.yellow, '+', xvt.reset, ' Bonus ')
                let d: number = 0
                while (!d) {
                    d = dice(9)
                    switch (d) {
                        case 1:
                            if (user.maxstr > 94) d = 0
                            break
                        case 2:
                            if (user.maxint > 94) d = 0
                            break
                        case 3:
                            if (user.maxdex > 94) d = 0
                            break
                        case 4:
                            if (user.maxcha > 94) d = 0
                            break
                        case 5:
                            if (user.melee > 2) d = 0
                            break
                        case 6:
                            if (user.backstab > 2) d = 0
                            break
                        case 7:
                            if (user.poison > 2) d = 0
                            break
                        case 8:
                            if (user.magic > 2) d = 0
                            break
                        case 9:
                            if (user.steal > 2) d = 0
                            break
                    }
                }

                switch (d) {
                    case 1:
                        if ((user.maxstr += 10) > 99)
                            user.maxstr = 99
                        xvt.out('Strength')
                        break
                    case 2:
                        if ((user.maxint += 10) > 99)
                            user.maxint = 99
                        xvt.out('Intellect')
                        break
                    case 3:
                        if ((user.maxdex += 10) > 99)
                            user.maxdex = 99
                        xvt.out('Dexterity')
                        break
                    case 4:
                        if ((user.maxcha += 10) > 99)
                            user.maxcha = 99
                        xvt.out('Charisma')
                        break
                    case 5:
                        user.melee++
                        xvt.out('Melee')
                        break
                    case 6:
                        user.backstab++
                        xvt.out('Backstab')
                        break
                    case 7:
                        user.poison++
                        xvt.out('Poison')
                        break
                    case 8:
                        if (user.magic < 4)
                            user.magic++
                        xvt.out('Spellcasting')
                        break
                    case 9:
                        user.steal++
                        xvt.out('Stealing')
                        break
                }
                xvt.out(' added')
                if (user != player) xvt.out(' to ', user.handle)
                xvt.outln(' ', xvt.bright, xvt.yellow, '+')
            }
            if ((user.str += rpc.toStr) > user.maxstr)
                user.str = user.maxstr
            if ((user.int += rpc.toInt) > user.maxint)
                user.int = user.maxint
            if ((user.dex += rpc.toDex) > user.maxdex)
                user.dex = user.maxdex
            if ((user.cha += rpc.toCha) > user.maxcha)
                user.cha = user.maxcha
            user.hp += PC.hp(user)
            user.sp += PC.sp(user)
        }
    }

    // the Ancient Riddle of the Keys
    export function riddle() {

        action('clear')
        xvt.outln()

        if (player.novice) {
            player.novice = false
            player.expert = true
            xvt.outln('You are no longer a novice.  Welcome to the next level of play.', -2000)
        }

        let bonus = 0
        let deeds = ['plays', 'jl', 'jw', 'killed', 'kills', 'retreats', 'steals', 'tl', 'tw']

        if (!Access.name[player.access].sysop) {
            mydeeds = loadDeed(player.pc)
            xvt.outln('\nChecking your deeds for the ', xvt.bright, player.pc, xvt.normal, ' list ... ', -1000)
            for (let i in deeds) {
                let deed = mydeeds.find((x) => { return x.deed == deeds[i] })
                if (/jw|steals|tw/.test(deeds[i])) {
                    if (!deed) deed = mydeeds[mydeeds.push(loadDeed(player.pc, deeds[i])[0]) - 1]
                    if (player[deeds[i]] >= deed.value) {
                        deed.value = player[deeds[i]]
                        saveDeed(deed)
                        bonus = 1
                        xvt.outln(xvt.cyan, ' + ', xvt.bright, Deed.name[deeds[i]].description, ' ', bracket(deed.value, false))
                        sound('click', 5)
                    }
                }
                else {
                    if (!deed) deed = mydeeds[mydeeds.push(loadDeed(player.pc, deeds[i])[0]) - 1]
                    if (deeds[i] == 'jl' && player.jl < 2 && player.jw < 5) continue
                    if (deeds[i] == 'tl' && player.tl < 2 && player.tw < 5) continue
                    if (player[deeds[i]] <= deed.value) {
                        deed.value = player[deeds[i]]
                        saveDeed(deed)
                        bonus = 1
                        xvt.outln(xvt.cyan, ' + ', xvt.bright, Deed.name[deeds[i]].description, ' ', bracket(deed.value, false))
                        sound('click', 5)
                    }
                }
            }

            mydeeds = loadDeed('GOAT')
            xvt.outln(xvt.magenta, '\nChecking your deeds for the ', xvt.bright, 'GOAT', xvt.normal, ' list ... ', -1000)
            for (let i in deeds) {
                let deed = mydeeds.find((x) => { return x.deed == deeds[i] })
                if (/jw|steals|tw/.test(deeds[i])) {
                    if (!deed) deed = mydeeds[mydeeds.push(loadDeed('GOAT', deeds[i])[0]) - 1]
                    if (player[deeds[i]] >= deed.value) {
                        deed.value = player[deeds[i]]
                        saveDeed(deed)
                        bonus = 2
                        xvt.outln(xvt.yellow, ' + ', xvt.bright, Deed.name[deeds[i]].description, ' ', bracket(deed.value, false))
                        sound('click', 5)
                    }
                }
                else {
                    if (!deed) deed = mydeeds[mydeeds.push(loadDeed('GOAT', deeds[i])[0]) - 1]
                    if (deeds[i] == 'jl' && player.jl < 2 && player.jw < 10) continue
                    if (deeds[i] == 'tl' && player.tl < 2 && player.tw < 10) continue
                    if (player[deeds[i]] <= deed.value) {
                        deed.value = player[deeds[i]]
                        saveDeed(deed)
                        bonus = 3
                        xvt.outln(xvt.yellow, ' + ', xvt.bright, Deed.name[deeds[i]].description, ' ', bracket(deed.value, false))
                        sound('click', 5)
                    }
                }
            }
        }
        else
            bonus = 2

        if (player.coward) {
            player.coward = false
            xvt.out('Welcome back to play with the rest of us ... ')
            if (bonus) {
                bonus--
                xvt.out(-600, xvt.faint, 'Heh.')
            }
            xvt.outln(-900)
        }

        music('immortal')
        player.immortal++
        xvt.outln(xvt.cyan, xvt.bright, '\nYou have become so powerful that you are now immortal ', -3000)
        run(`UPDATE Players SET bank=bank+${player.bank.value + player.coin.value} WHERE id='${taxman.user.id}'`)
        xvt.outln(xvt.cyan, '    and you leave your worldly possessions behind.', -2000)

        let max = Object.keys(PC.name['immortal']).indexOf(player.pc) + 1
        if (max || player.keyhints.slice(12).length > int(Object.keys(PC.name['player']).length / 2))
            player.keyhints.splice(12, 1)
        else
            player.keyhints.push(player.pc)

        reroll(player)
        saveUser(player)
        xvt.sessionAllowed += 300
        warning = 2

        if (max > 2) {
            music('victory')

            const log = `./files/winners.txt`
            fs.appendFileSync(log, sprintf(`%22s won on %s  -  game took %3d days\n`
                , player.handle
                , date2full(now().date)
                , now().date - sysop.dob + 1))
            loadUser(sysop)
            sysop.who = player.handle
            sysop.dob = now().date + 1
            sysop.plays = 0
            saveUser(sysop)

            player.wins++
            run(`UPDATE Players SET wins=${player.wins} WHERE id='${player.id}'`)
            reason = 'WON THE GAME !!'
            xvt.outln(tty == 'web' ? -4321 : -432)

            profile({ jpg: 'winner', effect: 'fadeInUp' })
            xvt.outln(xvt.yellow, xvt.bright, 'CONGRATULATIONS!! ', -600
                , xvt.reset, ' You have won the game!\n', -600)

            xvt.out(xvt.yellow, 'The board will now reset ', -600, xvt.faint)
            let rs = query(`SELECT id, pid FROM Online WHERE id != '${player.id}'`)
            for (let row in rs) {
                try {
                    process.kill(rs[row].pid, 'SIGHUP')
                    xvt.out('x')
                }
                catch {
                    xvt.out('?')
                }
                unlock(rs[row].id)
            }

            sound('winner')
            xvt.out(xvt.bright)

            rs = query(`SELECT id FROM Players WHERE id NOT GLOB '_*'`)
            let user: user = { id: '' }
            for (let row in rs) {
                user.id = rs[row].id
                loadUser(user)
                reroll(user)
                newkeys(user)
                user.keyhints.splice(12)
                saveUser(user)
                xvt.out('.', -10)
            }
            run(`UPDATE Rings SET bearer=''`)   // should be cleared by rerolls

            let i = 0
            while (++i) {
                try {
                    npc = <user>{}
                    Object.assign(npc, JSON.parse(fs.readFileSync(`${users}/bot${i}.json`).toString()))
                    let bot = <user>{}
                    Object.assign(bot, npc)
                    newkeys(bot)
                    bot.id = `_BOT${i}`
                    reroll(bot, bot.pc, bot.level)
                    Object.assign(bot, npc)
                    saveUser(bot)
                    xvt.out('&')
                }
                catch (err) {
                    break
                }
            }

            xvt.outln('Happy hunting tomorrow!\n', -5000)
            xvt.hangup()
        }

        player.today = 0
        xvt.out(xvt.yellow, xvt.bright, '\nYou are rewarded'
            , xvt.normal, ` ${access.calls} `, xvt.bright, 'more calls today.\n', xvt.reset)

        xvt.outln(xvt.green, xvt.bright, `\nOl' Mighty One!  `
            , xvt.normal, 'Solve the'
            , xvt.faint, ' Ancient Riddle of the Keys '
            , xvt.normal, 'and you will become\nan immortal being.')

        for (let i = 0; i <= max + bonus; i++) keyhint(online, false)
        saveUser(player)

        let prior: number = -1
        let slot: number
        for (let i in player.keyhints) {
            if (+i < 12 && player.keyhints[i]) {
                slot = int(+i / 3)
                if (slot !== prior) {
                    prior = slot
                    xvt.outln()
                }
                xvt.outln('Key #', xvt.bright, `${slot + 1}`, xvt.normal, ' is not ', Deed.key[player.keyhints[i]])
            }
        }

        action('riddle')
        let combo = player.keyseq

        xvt.app.form = {
            'key': {
                cb: () => {
                    let attempt = xvt.entry.toUpperCase()
                    music('steal')
                    xvt.out(' ... you insert and twist the key ', -1234)
                    for (let i = 0; i < 3; i++) {
                        xvt.out('.')
                        sound('click', 12)
                    }
                    if (attempt == combo[slot]) {
                        sound('max')
                        if (player.emulation == 'XT') xvt.out('🔓 ')
                        xvt.outln(xvt.cyan, '{', xvt.bright, 'Click!', xvt.normal, '}')
                        xvt.sessionAllowed += 60

                        player.pc = Object.keys(PC.name['immortal'])[slot]
                        profile({ png: 'player/' + player.pc.toLowerCase() + (player.gender == 'F' ? '_f' : ''), pc: player.pc })
                        xvt.out([xvt.red, xvt.blue, xvt.magenta][slot]
                            , 'You ', ['advance to', 'succeed as', 'transcend into'][slot]
                            , xvt.bright, an(player.pc), xvt.normal, '.')
                        reroll(player, player.pc)
                        newkeys(player)
                        player.coward = true
                        saveUser(player)

                        if (slot++ < max) {
                            xvt.app.refocus(`Insert key #${slot + 1}? `)
                            return
                        }

                        player.coward = false
                        playerPC([200, 210, 220, 240][slot], true)
                        return
                    }
                    else {
                        sound('thunder')
                        if (player.emulation == 'XT') xvt.out('💀 ')
                        xvt.outln(xvt.bright, xvt.black, '^', xvt.white, 'Boom!', xvt.black, '^')

                        if (slot == 0) {
                            for (let i = 0; i < 3; i++) {
                                if (player.keyhints[i] == attempt)
                                    break
                                if (!player.keyhints[i]) {
                                    player.keyhints[i] = attempt
                                    break
                                }
                            }
                            playerPC(200 + 4 * player.wins + int(player.immortal / 3))
                        }
                        else
                            playerPC([200, 210, 220, 240][slot], true)
                    }
                }, cancel: '!', eol: false, match: /P|G|S|C/i
            }
        }
        slot = 0
        xvt.drain()
        xvt.app.form['key'].prompt = `Insert key #${slot + 1}? `
        xvt.app.focus = 'key'
    }

    export function time(t: number): string {
        const ap = t < 1200 ? 'am' : 'pm'
        const m = t % 100
        const h = int((t < 100 ? t + 1200 : t >= 1300 ? t - 1200 : t) / 100)
        return sprintf('%u:%02u%s', h, m, ap)
    }

    export function titlecase(orig: string): string {
        return titleCase(orig)
    }

    export function what(rpc: active, action: string): string {
        return action + (rpc !== online ? (/.*ch$|.*sh$|.*s$|.*z$/i.test(action) ? 'es ' : 's ') : ' ')
    }

    export function worth(n: number, p: number): number {
        return int(n * p / 100)
    }

    export function beep() {
        if (player.emulation == 'XT')
            sound('max')
        else
            xvt.out('\x07', -125)
    }

    export function bracket(item: number | string, nl = true): string {
        var framed: string = item.toString()
        framed = xvt.attr(xvt.off, nl ? '\n' : '', framed.length == 1 && nl ? ' ' : ''
            , xvt.white, xvt.faint, '<', xvt.bright, framed, xvt.faint, '>'
            , nl ? ' ' : '', xvt.reset)
        return framed
    }

    export function buff(perm: number, temp: number, text = false): string {
        let keep = xvt.app.emulation
        if (text) xvt.app.emulation = 'dumb'
        let buff = ''
        if (perm || temp) {
            buff = xvt.attr(xvt.normal, xvt.magenta, ' (')
            if (perm > 0) buff += xvt.attr(xvt.bright, xvt.yellow, '+', perm.toString(), xvt.normal, xvt.white)
            else if (perm < 0) buff += xvt.attr(xvt.bright, xvt.red, perm.toString(), xvt.normal, xvt.white)
            else buff += xvt.attr(xvt.white, '+0')
            if (temp) buff += xvt.attr(','
                , (temp > 0) ? xvt.attr(xvt.yellow, xvt.bright, '+', temp.toString())
                    : xvt.attr(xvt.red, xvt.bright, temp.toString())
                , xvt.normal)
            buff += xvt.attr(xvt.magenta, ')', xvt.white)
        }
        if (text) xvt.app.emulation = keep
        return buff
    }

    export function cat(filename: string): boolean {
        const folder = './files/'
        let path = folder + filename
            + (xvt.app.emulation == 'PC' ? '.ibm' : xvt.app.emulation == 'XT' ? '.ans' : '.txt')

        try {
            fs.accessSync(path, fs.constants.F_OK)
            xvt.outln(fs.readFileSync(path, xvt.app.emulation == 'XT' ? 'utf8' : 'binary'), xvt.white)
            return true
        } catch (e) {
            if (xvt.app.emulation.match('PC|XT')) {
                let path = folder + filename + '.txt'
                try {
                    fs.accessSync(path, fs.constants.F_OK)
                    xvt.outln(fs.readFileSync(path), xvt.white)
                    return true
                } catch (e) {
                    return false
                }
            }
        }
    }

    export function clear() {
        const scroll = (xvt.row < player.rows ? xvt.row : player.rows) - (xvt.col == 1 ? 2 : 1)
        xvt.out(xvt.off)
        xvt.plot(player.rows, 1)
        xvt.outln('\n'.repeat(scroll))
        xvt.out(xvt.clear, -10) // allow XTerm to flush
    }

    export function death(by: string) {
        reason = by
        profile({ handle: `💀 ${reason} 💀`, png: `death${player.today}`, effect: 'fadeInDownBig' })
    }

    //  render a menu of options and return the prompt
    export function display(title: string, back: number, fore: number, suppress: boolean, menu: choices, hint?: string): string {
        menu['Q'] = {}  //  Q=Quit
        if (!suppress) {
            clear()
            if (!cat(`${title}/menu`)) {
                xvt.out('    ')
                if (back)
                    xvt.out(fore, '--=:))', xvt.app.LGradient,
                        back, xvt.bright, xvt.white, titlecase(title), xvt.reset,
                        fore, xvt.app.RGradient, '((:=--')
                else
                    xvt.out(titlecase(title))
                xvt.outln('\n')
                for (let i in menu) {
                    if (isNotEmpty(menu[i].description))
                        xvt.outln(xvt.faint, fore, '<', xvt.bright, xvt.white, i, xvt.faint, fore, '> ',
                            xvt.reset, menu[i].description)
                }
            }
            else {
                if (title == 'main') cat('border')
            }
        }

        if (process.stdout.rows && process.stdout.rows !== player.rows) {
            if (!player.expert) xvt.out('\n', xvt.yellow, xvt.app.Empty, xvt.bright
                , `Resetting your USER ROW setting (${player.rows}) to detected size ${process.stdout.rows}`
                , xvt.reset)
            player.rows = process.stdout.rows
        }

        if (hint && access.roleplay && dice(+player.expert * (player.immortal + 1) + player.level / 10) == 1)
            xvt.out('\n', xvt.bright, xvt.green, hint, xvt.reset)

        //  insert any wall messages here
        xvt.out('\x06')

        return xvt.attr(fore, '[', xvt.bright, xvt.yellow, back ? titlecase(title) : 'Iron Bank', xvt.normal, fore, ']'
            , xvt.faint, ' Option '
            , xvt.normal, xvt.cyan, '(Q=Quit): ')
    }

    export function emulator(cb: Function) {
        action('list')
        xvt.app.form = {
            'term': {
                cb: () => {
                    if (isNotEmpty(xvt.entry) && xvt.entry.length == 2) xvt.app.emulation = <xvt.emulator>xvt.entry.toUpperCase()
                    player.emulation = <EMULATION>xvt.app.emulation
                    if (tty == 'telnet') xvt.outln(`@title(${player.emulation})`, -100)
                    xvt.outln('\n', xvt.reset, xvt.magenta, xvt.app.LGradient, xvt.reverse, 'BANNER', xvt.noreverse, xvt.app.RGradient)
                    xvt.outln(xvt.red, 'R', xvt.green, 'G', xvt.blue, 'B', xvt.reset, xvt.bright, ' bold ', xvt.normal, 'normal', xvt.blink, ' flash ', xvt.noblink, xvt.faint, 'dim')
                    xvt.out(xvt.yellow, 'Cleric: ', xvt.bright, { VT: '\x1B(0\x7D\x1B(B', PC: '\x9C', XT: '✟', dumb: '$' }[player.emulation]
                        , xvt.normal, xvt.magenta, '  Teleport: ', xvt.bright, { VT: '\x1B(0\x67\x1B(B', PC: '\xF1', XT: '↨', dumb: '%' }[player.emulation])
                    online.altered = true
                    if (player.emulation == 'XT') {
                        xvt.outln(xvt.lblack, '  Bat: 🦇')
                        sound('yahoo', 22)
                        cb()
                        return
                    }
                    xvt.outln(-2200)
                    beep()
                    if (process.stdout.rows && process.stdout.rows !== player.rows)
                        player.rows = process.stdout.rows
                    for (let rows = player.rows + 5; rows > 1; rows--)
                        xvt.out(bracket(rows >= 24 ? rows : '..'))
                    xvt.app.form['rows'].prompt = xvt.attr('Enter top visible row number ', xvt.faint, '[', xvt.reset, xvt.bright, `${player.rows}`, xvt.faint, xvt.cyan, ']', xvt.reset, ': ')
                    xvt.app.focus = 'rows'
                }, prompt: xvt.attr('Select ', xvt.faint, '[', xvt.reset, xvt.bright, `${player.emulation}`, xvt.faint, xvt.cyan, ']', xvt.reset, ': ')
                , enter: player.emulation, match: /VT|PC|XT/i, max: 2
            },
            'rows': {
                cb: () => {
                    player.rows = +xvt.entry
                    xvt.outln()
                    xvt.app.focus = 'pause'
                }, enter: player.rows.toString(), max: 2, match: /^[2-9][0-9]$/
            },
            'pause': { cb: cb, pause: true }
        }

        xvt.outln('\n', xvt.cyan, 'Which emulation / character encoding are you using?')
        xvt.out(bracket('VT'), ' classic VT terminal with DEC drawing (telnet b&w)')
        xvt.out(bracket('PC'), ' former ANSI color with Western IBM CP850 (telnet color)')
        xvt.outln(bracket('XT'), ' modern ANSI color with UTF-8 & emojis (browser multimedia)')
        xvt.app.focus = 'term'
    }

    export function logoff() {

        if (!reason) {
            loadUser(sysop)
            //  caught screwing around?
            if (sysop.dob <= now().date) {
                if (access.roleplay) {
                    player.lasttime = now().time
                    PC.adjust('str', -1, -1, -1)
                    PC.adjust('int', -1, -1, -1)
                    PC.adjust('dex', -1, -1, -1)
                    PC.adjust('cha', -1, -1, -1)
                    saveUser(player)
                    unlock(player.id)
                }
                reason = xvt.reason || 'mystery'
                if (player && player.id) {
                    if (run(`UPDATE Players SET coward=1 WHERE id='${player.id}'`).changes)
                        news(`\tthe coward logged off ${time(player.lasttime)} (${reason})\n`, true)
                    access.roleplay = false
                }
            }
            else {  //  game was won
                access.roleplay = false
                loadUser(player)
                player.lasttime = now().time
                news(`\tonline player dropped by ${sysop.who} ${time(player.lasttime)} (${reason})\n`, true)
            }
        }
        else if (access.roleplay) {
            if (from == 'Dungeon' && online.hp > 0) {
                PC.adjust('cha', -1, -1, -1)
                player.coin = new coins(0)
                if (checkTime() >= 0) {
                    if (player.coward && !player.cursed) {
                        player.blessed = ''
                        player.cursed = player.id
                    }
                    player.coward = true
                }
                saveUser(player)
            }
        }

        if (isNotEmpty(player.id)) {
            if (access.roleplay) {
                //  did midnight or noon cross since last visit?
                if (player.lastdate != now().date || (player.lasttime < 1200 && now().time >= 1200))
                    player.today = 0
                player.lasttime = now().time
                player.remote = remote
                saveUser(player, false, true)
                news(`\treturned to ${whereis} at ${time(player.lasttime)} as a level ${player.level} ${player.pc}`)
                news(`\t(${reason})\n`, true)

                try {
                    callers = JSON.parse(fs.readFileSync(`${users}/callers.json`).toString())
                } catch (e) { }
                while (callers.length > 7)
                    callers.pop()
                callers = [<caller>{ who: player.handle, reason: reason }].concat(callers)
                fs.writeFileSync(`${users}/callers.json`, JSON.stringify(callers))
            }

            wall(`logged off: ${reason}`)
            unlock(player.id, true)
            unlock(player.id)

            //  logoff banner
            if (online.hp < 1)
                sound('goodbye')
            else {
                if (player.plays) sound(online.hull < 1 ? 'comeagain' : 'invite')
                PC.profile(online)
            }

            xvt.outln(-20, '\x06', -20)
            xvt.save()
            xvt.out(`\x1B[1;${player.rows}r`)
            xvt.restore()
            xvt.outln('Goodbye, please play again! ', -300, ' Also visit: ', -300)
            xvt.out(xvt.cyan, '  ___                               ___  \n')
            xvt.out('  \\_/   ', xvt.red, xvt.app.LGradient, xvt.bright, xvt.Red, xvt.white, 'Never Program Mad', xvt.reset, xvt.red, xvt.app.RGradient, xvt.cyan, '   \\_/  \n')
            xvt.out(' _(', xvt.bright, '-', xvt.normal, ')_     ', xvt.reset, ' https://npmjs.com    ', xvt.cyan, '  _(', xvt.bright, '-', xvt.normal, ')_ \n')
            xvt.out('(/ ', player.emulation == 'XT' ? xvt.attr(xvt.faint, '⚨', xvt.normal) : ':', ' \\)                          ', xvt.cyan, ' (/ ', player.emulation == 'XT' ? xvt.attr(xvt.faint, '⚨', xvt.normal) : ':', ' \\)\n')
            xvt.out('I\\___/I    ', xvt.green, xvt.app.LGradient, xvt.bright, xvt.Green, xvt.white, `RAH-CoCo's`, xvt.reset, xvt.green, xvt.app.RGradient, xvt.cyan, '     I\\___/I\n')
            xvt.out('\\/   \\/ ', xvt.reset, '   http://rb.gy/bruelx  ', xvt.cyan, '  \\/   \\/\n')
            xvt.out(' \\ : /                           ', xvt.cyan, '  \\ : / \n')
            xvt.out('  I:I     ', xvt.blue, xvt.app.LGradient, xvt.bright, xvt.Blue, xvt.white, `${player.emulation == 'XT' ? 'ℝ' : 'R'}ober${player.emulation == 'XT' ? 'ƭ ℍ' : 't H'}urs${player.emulation == 'XT' ? 'ƭ' : 't'}`, xvt.reset, xvt.blue, xvt.app.RGradient, xvt.cyan, '      I:I  \n')
            xvt.outln(' .I:I. ', xvt.reset, '   https://www.DDgame.us   ', xvt.cyan, ' .I:I.')
            xvt.outln(-500)
            xvt.outln(xvt.bright, xvt.black, process.title
                , ' running on ', xvt.bright, xvt.green, 'Node.js ', xvt.normal, process.version, xvt.reset
                , xvt.faint, ' (', xvt.cyan, process.platform, xvt.white, xvt.faint, ')', -1965)
            if (access.roleplay && player.today && player.level > 1)
                music(online.hp > 0 ? 'logoff' : 'death')
        }
        else
            sound('invite')
    }

    //  *****************************************
    //  my web client extended emulation commands
    export function action(menu: string) {
        if (tty == 'web') xvt.out(`@action(${menu})`)
    }

    export function animated(effect: string, sync = 2) {
        if (tty == 'web') xvt.out(`@animated(${effect})`, -10 * sync)
    }

    export function music(tune: string, sync = 2) {
        if (tty == 'web') xvt.out(`@tune(${tune})`, -10 * sync)
    }

    export function profile(params) {
        if (tty == 'web') xvt.out(`@profile(${JSON.stringify(params)})`)
    }

    export function sound(effect: string, sync = 2) {
        if (tty == 'web')
            xvt.out(`@play(${effect})`, -100 * sync)
        else
            xvt.beep()
    }

    export function title(name: string) {
        if (xvt.app.emulation == 'XT') xvt.out(`\x1B]2;${name}\x07`)
        if (tty == 'web') xvt.out(`@title(${name})`)
    }

    export function wall(msg: string) {
        xvt.out(`@wall(${player.handle} ${msg})`)
    }

    /***********
     *  DATABASE support functions
     ***********/
    const DD = `${users}/dankdomain.sql`
    export const sqlite3 = require('better-sqlite3')(DD, { timeout: 10000 })
    sqlite3.pragma('journal_mode = WAL')

    let rs = query(`SELECT * FROM sqlite_master WHERE name='Online' AND type='table'`)
    if (!rs.length) {
        xvt.out('\ninitializing online ... ')
        run(`CREATE TABLE IF NOT EXISTS Online (id text PRIMARY KEY, pid numeric, lockdate numeric, locktime numeric)`)
        xvt.out('done.', -250)
    }

    rs = query(`SELECT * FROM sqlite_master WHERE name='Players' AND type='table'`)
    if (!rs.length) {
        xvt.out('\ninitializing players ... ')
        run(`CREATE TABLE IF NOT EXISTS Players (
            id text PRIMARY KEY, handle text UNIQUE NOT NULL, name text NOT NULL, email text, password text NOT NULL,
            dob numeric NOT NULL, sex text NOT NULL, joined numeric, expires numeric, lastdate numeric,
            lasttime numeric, calls numeric, today numeric, expert integer, emulation text NOT NULL,
            rows numeric, access text NOT NULL, remote text, pc text, gender text,
            novice integer, level numeric, xp numeric, xplevel numeric, status text,
            blessed text, cursed text, coward integer, bounty numeric, who text,
            gang text, keyseq text, keyhints text, melee numeric, backstab numeric,
            poison numeric, magic numeric, steal numeric, hp numeric, sp numeric,
            str numeric, maxstr numeric, int numeric, maxint numeric, dex numeric,
            maxdex numeric, cha numeric, maxcha numeric, coin numeric, bank numeric,
            loan numeric, weapon text, toWC numeric, armor text, toAC numeric,
            spells text, poisons text, rings text, realestate text, security text,
            hull numeric, cannon numeric, ram integer, wins numeric, immortal numeric,
          	plays numeric, jl numeric, jw numeric, killed numeric, kills numeric,
            retreats numeric, steals numeric, tl numeric, tw numeric)`)
    }

    let npc = <user>{}
    Object.assign(npc, JSON.parse(fs.readFileSync(`${users}/sysop.json`).toString()))
    rs = query(`SELECT id FROM Players WHERE id='${npc.id}'`)
    if (!rs.length) {
        xvt.out(`[${npc.handle}]`)
        Object.assign(sysop, npc)
        newkeys(sysop)
        reroll(sysop, sysop.pc, sysop.level)
        sysop.xplevel = 0
        sysop.level = npc.level
        saveUser(sysop, true)
    }

    rs = query(`SELECT * FROM sqlite_master WHERE name='Rings' AND type='table'`)
    if (!rs.length) {
        xvt.out('\ninitializing (unique) rings ... ')
        run(`CREATE TABLE IF NOT EXISTS Rings (name text PRIMARY KEY, bearer text)`)
        xvt.out('done.', -250)
    }
    for (let i in Ring.name)
        ringBearer(i)

    rs = query(`SELECT * FROM sqlite_master WHERE name='Gangs' AND type='table'`)
    if (!rs.length) {
        xvt.out('\ninitializing gangs ... ')
        run(`CREATE TABLE IF NOT EXISTS Gangs (
            name text PRIMARY KEY, members text, win numeric, loss numeric, banner numeric, color numeric
        )`)
        run(`INSERT INTO Gangs VALUES ( 'Monster Mash', '_MM1,_MM2,_MM3,_MM4', 0, 0, 0, 0 )`)
        xvt.out('done.', -250)
    }

    rs = query(`SELECT * FROM sqlite_master WHERE name='Deeds' AND type='table'`)
    if (!rs.length) {
        xvt.out('\ninitializing deeds ... ')
        run(`CREATE TABLE IF NOT EXISTS Deeds (pc text KEY,
            deed text KEY, date numeric, hero text, value numeric
        )`)
        xvt.out('done.', -250)
    }

    //  customize the Master of Whisperers NPC
    npc = <user>{}
    Object.assign(npc, JSON.parse(fs.readFileSync(`${users}/barkeep.json`).toString()))
    rs = query(`SELECT id FROM Players WHERE id='${npc.id}'`)
    if (!rs.length) {
        xvt.out(`\n[${npc.handle}]`)
        Object.assign(barkeep.user, npc)
        newkeys(barkeep.user)
        reroll(barkeep.user, barkeep.user.pc, barkeep.user.level)
        Object.assign(barkeep.user, npc)
        saveUser(barkeep, true)
    }
    loadUser(barkeep)

    //  customize the Master at Arms NPC
    npc = <user>{}
    Object.assign(npc, JSON.parse(fs.readFileSync(`${users}/merchant.json`).toString()))
    rs = query(`SELECT id FROM Players WHERE id='${npc.id}'`)
    if (!rs.length) {
        xvt.out(`\n[${npc.handle}]`)
        Object.assign(dwarf.user, npc)
        newkeys(dwarf.user)
        reroll(dwarf.user, dwarf.user.pc, dwarf.user.level)
        Object.assign(dwarf.user, npc)
        saveUser(dwarf, true)
    }
    loadUser(dwarf)

    //  customize the Big Kahuna NPC
    npc = <user>{}
    Object.assign(npc, JSON.parse(fs.readFileSync(`${users}/neptune.json`).toString()))
    rs = query(`SELECT id FROM Players WHERE id='${npc.id}'`)
    if (!rs.length) {
        xvt.out(`\n[${npc.handle}]`)
        Object.assign(neptune.user, npc)
        newkeys(neptune.user)
        reroll(neptune.user, neptune.user.pc, neptune.user.level)
        Object.assign(neptune.user, npc)
        saveUser(neptune, true)
    }
    loadUser(neptune)

    //  customize the Queen B NPC
    npc = <user>{}
    Object.assign(npc, JSON.parse(fs.readFileSync(`${users}/seahag.json`).toString()))
    rs = query(`SELECT id FROM Players WHERE id='${npc.id}'`)
    if (!rs.length) {
        xvt.out(`\n[${npc.handle}]`)
        Object.assign(seahag.user, npc)
        newkeys(seahag.user)
        reroll(seahag.user, seahag.user.pc, seahag.user.level)
        Object.assign(seahag.user, npc)
        saveUser(seahag, true)
    }
    loadUser(seahag)

    //  customize the Master of Coin NPC
    npc = <user>{}
    Object.assign(npc, JSON.parse(fs.readFileSync(`${users}/taxman.json`).toString()))
    rs = query(`SELECT id FROM Players WHERE id='${npc.id}'`)
    if (!rs.length) {
        xvt.out(`\n[${npc.handle}]`)
        Object.assign(taxman.user, npc)
        newkeys(taxman.user)
        reroll(taxman.user, taxman.user.pc, taxman.user.level)
        Object.assign(taxman.user, npc)
        saveUser(taxman, true)
    }
    loadUser(taxman)

    //  customize the wicked witch
    npc = <user>{}
    Object.assign(npc, JSON.parse(fs.readFileSync(`${users}/witch.json`).toString()))
    rs = query(`SELECT id FROM Players WHERE id='${npc.id}'`)
    if (!rs.length) {
        xvt.out(`\n[${npc.handle}]`)
        Object.assign(witch.user, npc)
        newkeys(witch.user)
        reroll(witch.user, witch.user.pc, witch.user.level)
        Object.assign(witch.user, npc)
        saveUser(witch, true)
    }
    loadUser(witch)

    //  instantiate bot(s)
    let i = 0
    while (++i) {
        try {
            npc = <user>{}
            Object.assign(npc, JSON.parse(fs.readFileSync(`${users}/bot${i}.json`).toString()))
            rs = query(`SELECT id FROM Players WHERE id='${npc.id}'`)
            if (!rs.length) {
                xvt.out(`\nbot #${i} - ${npc.handle}`)
                let bot = <user>{}
                Object.assign(bot, npc)
                newkeys(bot)
                bot.id = `_BOT${i}`
                reroll(bot, bot.pc, bot.level)
                Object.assign(bot, npc)
                saveUser(bot, true)
            }
        }
        catch (err) {
            break
        }
    }

    function isActive(arg: any): arg is active {
        return (<active>arg).user !== undefined
    }

    function isUser(arg: any): arg is user {
        return (<user>arg).id !== undefined
    }

    export function loadKing(): boolean {
        //  King
        let ruler = Object.keys(Access.name).slice(-1)[0]
        rs = <user[]>query(`SELECT id FROM Players WHERE access = '${ruler}'`)
        if (rs.length) {
            king.id = rs[0].id
            return loadUser(king)
        }
        //  Queen
        ruler = Object.keys(Access.name).slice(-2)[0]
        rs = <user[]>query(`SELECT id FROM Players WHERE access = '${ruler}'`)
        if (rs.length) {
            king.id = rs[0].id
            return loadUser(king)
        }
        return false
    }

    export function loadUser(rpc): boolean {
        let user: user = isActive(rpc) ? rpc.user : rpc
        let sql = 'SELECT * FROM Players WHERE '
        if (user.handle) user.handle = titlecase(user.handle)
        sql += (user.id) ? `id = '${user.id.toUpperCase()}'` : `handle = '${user.handle}'`

        rs = query(sql)
        if (rs.length) {
            Object.assign(user, rs[0])
            user.coin = new coins(rs[0].coin)
            user.bank = new coins(rs[0].bank)
            user.loan = new coins(rs[0].loan)
            user.bounty = new coins(rs[0].bounty)

            user.keyhints = rs[0].keyhints.split(',')

            user.poisons = []
            if (rs[0].poisons.length) {
                let vials = rs[0].poisons.split(',')
                for (let i = 0; i < vials.length; i++)
                    Poison.add(user.poisons, vials[i])
            }

            user.spells = []
            if (rs[0].spells.length) {
                let spells = rs[0].spells.split(',')
                for (let i = 0; i < spells.length; i++)
                    Magic.add(user.spells, spells[i])
            }

            user.rings = []
            if (rs[0].rings.length) {
                let rings = rs[0].rings.split(',')
                for (let i = 0; i < rings.length; i++)
                    Ring.wear(user.rings, rings[i].replace(/''/g, `'`))
            }

            if (isActive(rpc)) activate(rpc)

            //  restore NPC to static state
            if (user.id[0] == '_' && user.id !== "_SYS") {
                let npc = <user>{ id: user.id }
                try {
                    const js = JSON.parse(fs.readFileSync(`./users/${{ "_BAR": "barkeep", "_DM": "merchant", "_NEP": "neptune", "_OLD": "seahag", "_TAX": "taxman", "_WOW": "witch" }[npc.id]}.json`).toString())
                    if (js) {
                        Object.assign(npc, js)
                        Object.assign(user, npc)
                        reroll(user, user.pc, user.level)
                        Object.assign(user, npc)
                        saveUser(user)
                    }
                }
                catch (err) { }
            }

            return true
        }
        else {
            user.id = ''
            return false
        }
    }

    export function saveUser(rpc, insert = false, locked = false) {

        let user: user = isActive(rpc) ? rpc.user : rpc

        if (isEmpty(user.id)) return
        if (insert || locked || user.id[0] == '_') {
            let trace = `${users}/.${user.id}.json`
            fs.writeFileSync(trace, JSON.stringify(user, null, 2))
        }

        let sql = insert ? `INSERT INTO Players
        ( id, handle, name, email, password
        , dob, sex, joined, expires, lastdate
        , lasttime, calls, today, expert, emulation
        , rows, access, remote, pc, gender
        , novice, level, xp, xplevel, status
        , blessed, cursed, coward, bounty, who
        , gang, keyseq, keyhints, melee, backstab
        , poison, magic, steal, hp, sp
        , str, maxstr, int, maxint, dex
        , maxdex, cha, maxcha, coin, bank
        , loan, weapon, toWC, armor, toAC
        , spells, poisons, realestate, rings, security
        , hull, cannon, ram, wins, immortal
        , plays, jl, jw, killed, kills
        , retreats, steals, tl, tw
        ) VALUES
        ('${user.id}', '${user.handle}', '${user.name}', '${user.email}', '${user.password}'
        , ${user.dob}, '${user.sex}', ${user.joined}, ${user.expires}, ${user.lastdate}
        , ${user.lasttime}, ${user.calls}, ${user.today}, ${+user.expert}, '${user.emulation}'
        , ${user.rows}, '${user.access}', '${user.remote}', '${user.pc}', '${user.gender}'
        , ${+user.novice}, ${user.level}, ${user.xp}, ${user.xplevel}, '${user.status}'
        ,'${user.blessed}', '${user.cursed}', ${+user.coward}, ${user.bounty.value}, '${user.who}'
        ,'${user.gang}', '${user.keyseq}', '${user.keyhints.toString()}', ${user.melee}, ${user.backstab}
        , ${user.poison}, ${user.magic}, ${user.steal}, ${user.hp}, ${user.sp}
        , ${user.str}, ${user.maxstr}, ${user.int}, ${user.maxint}, ${user.dex}
        , ${user.maxdex}, ${user.cha}, ${user.maxcha}, ${user.coin.value}, ${user.bank.value}
        , ${user.loan.value}, '${user.weapon}', ${user.toWC}, '${user.armor}', ${user.toAC}
        ,'${user.spells.toString()}', '${user.poisons.toString()}', '${user.realestate}', ?, '${user.security}'
        , ${user.hull}, ${user.cannon}, ${+user.ram}, ${user.wins}, ${user.immortal}
        , ${user.plays}, ${user.jl}, ${user.jw}, ${user.killed}, ${user.kills}
        , ${user.retreats}, ${user.steals}, ${user.tl}, ${user.tw}
        )`
            : `UPDATE Players SET
        handle='${user.handle}', name='${user.name}', email='${user.email}', password='${user.password}',
        dob=${user.dob}, sex='${user.sex}', joined=${user.joined}, expires=${user.expires}, lastdate=${user.lastdate},
        lasttime=${user.lasttime}, calls=${user.calls}, today=${user.today}, expert=${+user.expert}, emulation='${user.emulation}',
        rows=${user.rows}, access='${user.access}', remote='${user.remote}', pc='${user.pc}', gender='${user.gender}',
        novice=${+user.novice}, level=${user.level}, xp=${user.xp}, xplevel=${user.xplevel}, status='${user.status}',
        blessed='${user.blessed}', cursed='${user.cursed}', coward=${+user.coward}, bounty=${user.bounty.value}, who='${user.who}',
        gang='${user.gang}', keyseq='${user.keyseq}', keyhints='${user.keyhints.toString()}', melee=${user.melee}, backstab=${user.backstab},
        poison=${user.poison}, magic=${user.magic}, steal=${user.steal}, hp=${user.hp}, sp=${user.sp},
        str=${user.str}, maxstr=${user.maxstr}, int=${user.int}, maxint=${user.maxint}, dex=${user.dex},
        maxdex=${user.maxdex}, cha=${user.cha}, maxcha=${user.maxcha}, coin=${user.coin.value}, bank=${user.bank.value},
        loan=${user.loan.value}, weapon='${user.weapon}', toWC=${user.toWC}, armor='${user.armor}', toAC=${user.toAC},
        spells='${user.spells.toString()}', poisons='${user.poisons.toString()}', realestate='${user.realestate}', rings=?, security='${user.security}',
        hull=${user.hull}, cannon=${user.cannon}, ram=${+user.ram}, wins=${user.wins}, immortal=${user.immortal},
        plays=${user.plays}, jl=${user.jl}, jw=${user.jw}, killed=${user.killed}, kills=${user.kills},
        retreats=${user.retreats}, steals=${user.steals}, tl=${user.tl}, tw=${user.tw}
        WHERE id='${user.id}'`
        run(sql, false, user.rings.toString())

        if (isActive(rpc)) rpc.altered = false
        if (locked) unlock(user.id.toLowerCase())
    }

    export function newDay() {
        xvt.out('One moment: [')

        run(`UPDATE Players SET bank=bank+coin WHERE id NOT GLOB '_*'`)
        xvt.out('+')
        run(`UPDATE Players SET coin=0`)
        xvt.out('-')

        let rs = query(`SELECT id FROM Players WHERE id NOT GLOB '_*' AND status='' AND (magic=1 OR magic=2) AND bank>9999999 AND level>15`)
        let user: user = { id: '' }
        for (let row in rs) {
            let altered = false
            user.id = rs[row].id
            loadUser(user)
            for (let item = 7; item < 15; item++) {
                let cost = user.magic == 1 ? new coins(Magic.spells[Magic.merchant[item]].wand)
                    : new coins(Magic.spells[Magic.merchant[item]].cost)
                if (user.bank.value >= cost.value && !Magic.have(user.spells, item)) {
                    Magic.add(user.spells, item)
                    user.bank.value -= cost.value
                    altered = true
                }
            }
            if (altered) saveUser(user)
        }
        xvt.out('=')

        rs = query(`SELECT id, access, lastdate, level, xplevel, novice, jl, jw, gang FROM Players WHERE id NOT GLOB '_*'`)
        for (let row in rs) {
            if ((rs[row].level == 1 || rs[row].novice) && (rs[row].jl > (2 * rs[row].jw)))
                run(`UPDATE Players SET jl=0,jw=0 WHERE id='${rs[row].id}'`)
            if (Access.name[rs[row].access].bot)
                continue
            //  manually rolled back system date _after_ some player visited?
            if (!(now().date - rs[row].lastdate))
                continue

            if ((now().date - rs[row].lastdate) > 10) {
                if (Access.name[rs[row].access].roleplay) {
                    if (+rs[row].xplevel > 1) {
                        run(`UPDATE Players SET xplevel=1,remote='' WHERE id='${rs[row].id}'`)
                        let p: user = { id: rs[row].id }
                        loadUser(p)
                        require('./email').rejoin(p)
                        xvt.out('_', -1000)
                        continue
                    }
                }
                else {
                    run(`DELETE FROM Players WHERE id='${rs[row].id}'`)
                    fs.unlink(`./files/user/${rs[row].id}.txt`, () => { })
                    xvt.out('x')
                    continue
                }
            }

            if ((now().date - rs[row].lastdate) > 180) {
                if (rs[row].gang) {
                    let g = loadGang(query(`SELECT * FROM Gangs WHERE name='${rs[row].gang}'`)[0])
                    let i = g.members.indexOf(rs[row].id)
                    if (i > 0) {
                        g.members.splice(i, 1)
                        saveGang(g)
                    }
                    else {
                        run(`UPDATE Players SET gang='' WHERE gang='${g.name}'`)
                        run(`DELETE FROM Gangs WHERE name='${g.name}'`)
                        xvt.out('&')
                    }
                }
                run(`DELETE FROM Players WHERE id='${rs[row].id}'`)
                fs.unlink(`./files/user/${rs[row].id}.txt`, () => { })
                xvt.out('x')
                continue
            }

            if ((now().date - rs[row].lastdate) % 50 == 0) {
                run(`UPDATE Players SET pc='${Object.keys(PC.name['player'])[0]}',level=1,xplevel=0,remote='' WHERE id='${rs[row].id}'`)
                let p: user = { id: rs[row].id }
                loadUser(p)
                require('./email').rejoin(p)
                xvt.sleep(1000)
            }
        }

        try {
            fs.renameSync('./files/tavern/today.txt', './files/tavern/yesterday.txt')
            xvt.out('T')
        } catch (e) {
            xvt.out('?')
        }
        xvt.out(']')

        sysop.lastdate = now().date
        sysop.lasttime = now().time
        saveUser(sysop)
        xvt.outln(xvt.bright, xvt.yellow, '*')
        beep()
        xvt.outln('All set -- thank you!\n')
    }

    export function lock(id: string, owner = 0): boolean {

        if (owner == 1) {
            try {
                sqlite3.exec(`INSERT INTO Online (id, pid, lockdate, locktime) VALUES ('${id}', ${process.pid}, ${now().date}, ${now().time})`)
                return true
            }
            catch (err) {
                if (err.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                    xvt.beep()
                    xvt.outln(xvt.reset, '\n?Unexpected error: ', String(err))
                    reason = 'defect - ' + err.code
                    xvt.hangup()
                }
                return false
            }
        }
        else {
            let rs = query(`SELECT id FROM Online WHERE id LIKE '${id}'`)
            if (!rs.length) {
                if (owner == 2)
                    run(`INSERT INTO Online (id, pid, lockdate, locktime) VALUES ('${id.toLowerCase()}', ${process.pid}, ${now().date}, ${now().time})`)
                return true
            }
            return false
        }
    }

    export function unlock(id: string, mine = false): number {
        if (mine) return run(`DELETE FROM Online WHERE id!='${id}' AND pid=${process.pid}`).changes
        return run(`DELETE FROM Online WHERE id='${id}'`).changes
    }

    export function query(q: string, errOk = false, ...params): any {
        try {
            let cmd = sqlite3.prepare(q)
            return cmd.all(...params)
        }
        catch (err) {
            if (!errOk) {
                xvt.outln()
                beep()
                xvt.outln(xvt.red, '?Unexpected error: ', xvt.bright, String(err))
                xvt.out(q)
                reason = 'defect - ' + err.code
                xvt.hangup()
            }
            return []
        }
    }

    export function run(sql: string, errOk = false, ...params): { changes: number, lastInsertROWID: number } {
        let retry = 3

        while (retry) {
            try {
                let cmd = sqlite3.prepare(sql)
                return cmd.run(...params)
            }
            catch (err) {
                xvt.beep()
                xvt.out(xvt.reset, '\n?Unexpected SQL error: ', String(err))
                if (--retry) {
                    xvt.outln(' -- retrying')
                    continue
                }
                if (!errOk) {
                    xvt.out('\n?FATAL SQL operation: ', sql)
                    /***
                    sql = users + user.id + '.sql'
                    if (process.platform == 'linux') {
                        require('child_process').exec(`
                            sqlite3 ${DD} <<-EOD
                            .mode insert
                            .output ${sql}
                            select * from Players where id = '${user.id}';
                            EOD
                        `)
                    }
                    ***/
                    reason = 'defect - ' + err.code
                    xvt.hangup()
                }
                return { changes: 0, lastInsertROWID: 0 }
            }
        }
    }

    export function loadDeed(pc: string, what?: string): deed[] {

        let deed = []
        let sql = `SELECT * FROM Deeds WHERE pc='${pc}'`
        if (what) sql += ` AND deed='${what}'`
        let rs = query(sql)

        if (rs.length) {
            for (let i = 0; i < rs.length; i++)
                deed.push({
                    pc: rs[i].pc,
                    deed: rs[i].deed,
                    date: rs[i].date,
                    hero: rs[i].hero,
                    value: rs[i].value
                })
        }
        else if (what) {
            let start = 0
            if (Deed.name[what]) start = Deed.name[what].starting
            run(`INSERT INTO Deeds VALUES ('${pc}', '${what}', ${now().date}, 'Nobody', ${start})`)
            deed = loadDeed(pc, what)
        }

        return deed
    }

    export function saveDeed(deed: deed) {
        if (!player.novice) {
            deed.date = now().date
            deed.hero = player.handle
            run(`UPDATE Deeds SET date=${deed.date},hero='${deed.hero}', value=${deed.value} WHERE pc='${deed.pc}' AND deed='${deed.deed}'`)
            if (player.level < 100) {
                PC.adjust('str', 101)
                PC.adjust('int', 101)
                PC.adjust('dex', 101)
                PC.adjust('cha', 101)
                sound('outstanding')
            }
        }
    }

    export function loadGang(rs: any): gang {
        let gang: gang = {
            name: rs.name,
            members: rs.members.split(','),
            handles: [],
            genders: [],
            melee: [],
            status: [],
            validated: [],
            win: rs.win,
            loss: rs.loss,
            banner: int(rs.banner / 16),
            trim: rs.banner % 8,
            back: int(rs.color / 16),
            fore: rs.color % 8
        }

        for (let n = 0; n < 4 && n < gang.members.length; n++) {
            let who = query(`SELECT handle,gender,melee,status,gang FROM Players WHERE id='${gang.members[n]}'`)
            if (who.length) {
                gang.handles.push(who[0].handle)
                gang.genders.push(who[0].gender)
                gang.melee.push(who[0].melee)
                if (gang.members[n] !== player.id && !who[0].status && !lock(gang.members[n]))
                    who[0].status = 'locked'
                gang.status.push(who[0].status)
                gang.validated.push(who[0].gang ? who[0].gang == rs.name : undefined)
            }
            else if (gang.members[n][0] == '_') {
                gang.handles.push('')
                gang.genders.push('I')
                gang.melee.push(0)
                gang.status.push('')
                gang.validated.push(true)
            }
            else {
                gang.handles.push(`?unknown ${gang.members[n]}`)
                gang.genders.push('M')
                gang.melee.push(3)
                gang.status.push('?')
                gang.validated.push(false)
            }
        }

        return gang
    }

    export function saveGang(g: gang, insert = false) {
        if (insert) {
            try {
                sqlite3.exec(`INSERT INTO Gangs (name,members,win,loss,banner,color)
                VALUES ('${g.name}', '${g.members.join()}', ${g.win}, ${g.loss},
                ${(g.banner << 4) + g.trim}, ${(g.back << 4) + g.fore})`)
            }
            catch (err) {
                if (err.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                    xvt.outln()
                    beep()
                    xvt.outln(xvt.red, '?Unexpected error: ', xvt.bright, String(err), -2000)
                }
            }
        }
        else {
            if (g.members.length > 4) g.members.splice(0, 4)
            run(`UPDATE Gangs
                SET members='${g.members.join()}',win=${g.win},loss=${g.loss}
                ,banner=${(g.banner << 4) + g.trim},color=${(g.back << 4) + g.fore}
            WHERE name = '${g.name}'`)
        }
    }

    export function ringBearer(name: string): string {
        if (Ring.name[name].unique) {
            let rs = query(`SELECT bearer FROM Rings WHERE name=?`, false, name)
            if (!rs.length) {
                run(`INSERT INTO Rings (name,bearer) VALUES (?,'')`, false, name)
                return ''
            }
            return rs[0].bearer
        }
        return ''
    }

    export function getRing(how: string, what: string) {
        xvt.outln()
        xvt.out(xvt.bright, xvt.yellow, 'You ', how, an(what, false))
        xvt.out(xvt.cyan, what, xvt.normal)
        if (player.emulation == 'XT') xvt.out(' ', Ring.name[what].emoji, ' 💍')
        xvt.outln(' ring', xvt.reset, ', which can\n'
            , xvt.bright, xvt.yellow, Ring.name[what].description)
        profile({ jpg: `ring/${what}`, handle: `${what} ${Ring.name[what].emoji} 💍 ring`, effect: 'tada' })
    }

    export function saveRing(name: string, bearer = '', rings?: string[]) {
        let theRing = { name: name, bearer: bearer[0] == '_' ? '' : bearer }

        //  primarily maintain the one ring's active bearer here
        if (Ring.name[name].unique) {
            run(`UPDATE Rings SET bearer='${theRing.bearer}' WHERE name=?`, false, name)
        }
        if (theRing.bearer.length && rings) {
            run(`UPDATE Players SET rings=? WHERE id=?`, false, rings.toString(), theRing.bearer)
        }
    }
}

export = Common
