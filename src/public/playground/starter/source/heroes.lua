-- Start here to compare the three heroes without changing the movement code.
-- Attack intervals are in seconds. Muzzle points use the original 256 by 192 frame.
-- Each attack pose has its own point so the bow and staff can move naturally.
local Heroes = {
    order = {'warrior', 'archer', 'mage'},
    warrior = {
        name = 'Warrior',
        weapon = 'sword',
        attackInterval = 0.32,
        attackDuration = 0.30,
        description = 'Sword / close range',
    },
    archer = {
        name = 'Archer',
        weapon = 'arrow',
        releaseFrame = 3,
        muzzlePoints = {
            {x = 181, y = 130},
            {x = 188, y = 99},
            {x = 188, y = 94},
            {x = 185, y = 94},
            {x = 186, y = 95},
            {x = 181, y = 130},
        },
        attackInterval = 0.18,
        attackDuration = 0.26,
        description = 'Bow / fast arrows',
    },
    mage = {
        name = 'Mage',
        weapon = 'fireball',
        releaseFrame = 3,
        muzzlePoints = {
            {x = 186, y = 76},
            {x = 176, y = 29},
            {x = 202, y = 98},
            {x = 208, y = 102},
            {x = 213, y = 100},
            {x = 188, y = 76},
        },
        attackInterval = 0.38,
        attackDuration = 0.34,
        description = 'Staff / powerful magic',
    },
}

return Heroes
