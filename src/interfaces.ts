/*****************************************************************************\
 *  Ɗaɳƙ Ɗoɱaiɳ: the return of Hack & Slash                                  *
 *  INTERFACES authored by: Robert Hurst <theflyingape@gmail.com>            *
\*****************************************************************************/

interface access {
    F?: string
    M?: string
    bot?: boolean
    calls: number
    minutes: number
    promote: number
    message?: string
    verify: boolean
    roleplay: boolean
    sysop?: boolean
    emoji?: string
}

interface active {
    user: user
    altered?: boolean
    pc?: character
    who?: who
    weapon?: weapon
    armor?: armor
    toAC?: number
    toWC?: number
    adept?: number      //  0 - 5: situational modifiers
    str?: number
    int?: number
    dex?: number
    cha?: number
    confused?: boolean
    bp?: number
    hp?: number         //  <0=retreated, 0=killed, >0=alive
    sp?: number
    hull?: number
    monster?: monster
    effect?: string
}

interface argument {
    who?: string
    text?: string
}

interface armor {
    text: string
    value: string
    ac: number
    armoury?: boolean
    dwarf?: boolean
}

interface bot {
    backstab?: number
    brawl?: number
    dungeon?: number
    gamble?: number
    joust?: number
    fish?: number
    monster?: number
    naval?: number
    party?: number
    steal?: number
    user?: number
}

interface caller {
    who?: string
    reason?: string
}

interface cards {
    face: string
    suit: SUIT
    value: number
    uni: string
}

interface character {
    melee: number       //  0-4
    backstab: number    //  0-4
    poison: number      //  0-4
    magic: number       //  0-4
    steal: number       //  0-4
    baseStr: number     //  20-80
    baseInt: number     //  20-80
    baseDex: number     //  20-80
    baseCha: number     //  20-80
    toStr: number       //  0-4
    toInt: number       //  0-4
    toDex: number       //  0-4
    toCha: number       //  0-4
    maxStr: number      //  baseStr-99
    maxInt: number      //  baseInt-99
    maxDex: number      //  baseDex-99
    maxCha: number      //  baseCha-99
    unicode: string     //  dungeon map symbol
    color?: number      //  symbol's color
    skip?: string       //  action
    difficulty?: string //  playing level
    specialty?: string  //  meta
    description?: string[]
    bonusStr?: number    //  0-2
    bonusInt?: number    //  0-2
    bonusDex?: number    //  0-2
    bonusCha?: number    //  0-2
}

interface choice {
    description?: string
}
interface choices {
    [key: string]: choice
}

interface coin {
    value: number
    amount: string
    carry?(number?, boolean?): string
    pieces?(string?): string
}

interface ddd {
    alert: boolean      //  play sound 'find the exit'
    cleric: active
    events: number      //  max motivations for lingering
    exit: boolean       //  prompt user to expedite effort to another level
    map: MAP
    mob: number         //  max monster capacity in a cavern
    moves: number       //  hero steps (2x backtracking)
    rooms: [room[]]     //	7-10
    spawn: number       //  2-23
    width: number		//	7-13
}

interface deed {
    pc: string
    deed: DEED
    date: number
    hero: string
    value: number
}

interface deeds {
    name: string
    description: string
    starting: number
}

interface gang {
    name: string
    members: string[]
    handles: string[]
    genders: string[]
    melee: number[]
    status: string[]
    validated: boolean[]
    win: number
    loss: number
    banner: number
    trim: number
    back: number
    fore: number
}

interface monster {
    name: string
    pc: string
    adept?: number
    size?: number
    hit?: string
    smash?: string
    poisons?: string[]
    rings?: string[]
    spells?: string[]
    level?: number
    weapon?: string | number
    armor?: string | number
    money?: string | number
    effect?: string
}

interface naval {
    name: string
    int: number
    hull: number
    shot: number
    powder: number
    ram: boolean
    money?: string | number
}

interface poison {
    power: number
    cost: string
    vial: string
}

interface realestate {
    value: string
    protection: number
}

interface ring {
    unique: boolean
    description: string
    emoji: string
    ability: [{
        id: string
        power: boolean
        magic?: number
        pc?: string
        spell?: string
    }]
}

interface room {
    map: boolean		//	explored?
    occupant: NPC
    size: number
    type: ROOM
    giftItem?: GIFT
    giftValue?: number | string
    giftID?: boolean	//	undefined, or identified?
    giftIcon?: string
    monster?: active[]
}

interface security {
    value: string
    protection: number
}

interface spell {
    cast: number
    mana: number
    enchanted: number
    cost?: string
    wand?: string
}

interface user {
    id: string
    handle?: string
    bot?: bot

    //  real
    name?: string
    email?: string
    password?: string
    dob?: number
    sex?: string
    joined?: number
    expires?: number
    lastdate?: number
    lasttime?: number
    calls?: number
    today?: number
    expert?: boolean
    emulation?: EMULATION
    rows?: number
    access?: string
    remote?: string

    //  playing character
    pc?: string
    gender?: string
    novice?: boolean

    //  current standing
    level?: number
    xp?: number
    xplevel?: number
    status?: string
    blessed?: string
    cursed?: string
    coward?: boolean
    bounty?: coin
    who?: string
    gang?: string
    keyseq?: string
    keyhints?: string[]

    //  character class attributes
    melee?: number
    backstab?: number
    poison?: number
    magic?: number
    steal?: number
    hp?: number
    sp?: number
    str?: number
    maxstr?: number
    int?: number
    maxint?: number
    dex?: number
    maxdex?: number
    cha?: number
    maxcha?: number

    //  character materials
    coin?: coin
    bank?: coin
    loan?: coin
    weapon?: string | number
    toWC?: number
    armor?: string | number
    toAC?: number
    spells?: number[]
    poisons?: number[]
    rings?: string[]
    realestate?: string
    security?: string
    hull?: number
    cannon?: number
    ram?: boolean

    //  statistics
    wins?: number
    immortal?: number
    //  per roll
    plays?: number
    jl?: number
    jw?: number
    killed?: number
    kills?: number
    retreats?: number
    steals?: number
    tl?: number
    tw?: number
}

interface vial {
    potion: number
    identified: boolean
    image: string
    description: string
}

interface weapon {
    text: string
    value: string
    wc: number
    hit: string
    smash: string
    stab: string
    plunge: string
    shoppe?: boolean
    dwarf?: boolean
}

interface who {
    He: string
    he: string
    him: string
    His: string
    his: string
    self: string
    You: string
    you: string
}
