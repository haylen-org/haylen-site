-- Draw the interface in screen space so it stays still while the camera moves.
local graphics = require('haylen.graphics2d')
local input = require('haylen.input')
local Art = require('art')
local Heroes = require('heroes')

local Hud = {}

local function drawText(message, x, y, size, color)
    graphics.drawText(nil, message, x, y, {size = size, color = color or '#FFFFF3D5'})
end

local function drawHeroCards(game)
    for index, name in ipairs(Heroes.order) do
        local x = 433 + (index - 1) * 137
        local selected = game.player.hero == name
        local panelColor = selected and '#E6477353' or '#DC17352D'

        graphics.drawRect({x, 22, 128, 61}, panelColor)
        graphics.draw(Art.portrait(name), x + 6, 29, {
            width = 44,
            height = 47,
            pivotX = 0,
            pivotY = 0,
        })
        drawText(tostring(index), x + 58, 29, 16, '#FFFFD779')
        drawText(Heroes[name].name, x + 57, 53, 14)
    end
end

local function drawResult(game)
    local won = game.state == 'won'
    local title = won and 'QUEST COMPLETE' or 'TRY AGAIN, HERO'

    graphics.drawRect({0, 0, 1280, 720}, '#B810241E')
    graphics.drawRect({300, 220, 680, 258}, '#EE17352D')
    drawText(title, 363, 263, 44, won and '#FFFFDA7D' or '#FFFFB6A0')
    drawText(string.format('%d foes defeated  /  %d relics found', game.kills, game.relicCount), 365, 337, 23)
    local retryHint = 'Press R or tap Jump to start a new quest.'

    if input.lastDevice() == 'gamepad' then
        retryHint = 'Press Jump or Back to start a new quest.'
    end

    drawText(retryHint, 365, 394, 22, '#FFC6DBCE')
end

function Hud.draw(game)
    graphics.beginScreen()

    -- Health and objectives remain readable against the bright forest artwork.
    graphics.drawRect({24, 22, 310, 100}, '#E017352D')
    graphics.drawRect({24, 22, 3, 100}, '#FFFFD779')
    drawText('E M B E R F A L L', 43, 34, 25)
    drawText(Heroes[game.player.hero].description, 44, 69, 16, '#FFBBDBC6')

    for index = 1, 5 do
        local color = game.player.health >= index and '#FFEF8B70' or '#FF3B5549'
        graphics.drawRect({44 + (index - 1) * 45, 98, 36, 7}, color)
    end

    drawHeroCards(game)

    graphics.drawRect({969, 22, 286, 100}, '#E017352D')
    drawText(string.format('RELICS  %02d / %02d', game.relicCount, #game.relics), 993, 34, 24, '#FFFFD779')
    drawText('Find relics. Defeat the guardian.', 993, 76, 14, '#FFBBDBC6')

    graphics.drawRect({24, 665, 1231, 32}, '#DC17352D')
    local controls = 'A D  MOVE    SPACE  DOUBLE JUMP    X / J  ATTACK    SHIFT  DASH'
        .. '    C  HERO    R  RETRY    M  SOUND'

    if input.lastDevice() == 'gamepad' then
        controls = 'LEFT STICK  MOVE    RIGHT STICK  AIM    BOTTOM  JUMP    RT / LEFT  ATTACK'
            .. '    RIGHT  DASH    TOP  HERO    BACK  RETRY'
    end

    drawText(controls, 42, 673, 15)

    if game.boss.alive and math.abs(game.player.x - game.boss.x) < 850 then
        local healthFraction = game.boss.health / game.boss.maxHealth
        graphics.drawRect({420, 130, 440, 7}, '#FF3E503F')
        graphics.drawRect({420, 130, 440 * healthFraction, 7}, '#FFE88E65')
        drawText('THE FOREST GUARDIAN', 527, 104, 18, '#FF17352D')
    end

    if game.state ~= 'playing' then
        drawResult(game)
    end
end

return Hud
