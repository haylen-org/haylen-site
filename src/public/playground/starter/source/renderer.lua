-- The renderer draws the world. Screen-space labels belong to hud.lua.
local graphics = require('haylen.graphics2d')
local Art = require('art')
local Hud = require('hud')

local Renderer = {}
Renderer.__index = Renderer

function Renderer.new()
    return setmetatable({background = Art.texture('forest')}, Renderer)
end

function Renderer:drawBackground(game)
    graphics.beginScreen()

    -- The distant forest scrolls more slowly than the camera to create depth.
    local panoramaWidth = 1536
    local panoramaHeight = panoramaWidth * self.background.height / self.background.width
    local scroll = (game.camera.position.x - 640) * 0.12

    for index = -1, 1 do
        graphics.draw(self.background, -scroll % panoramaWidth + index * panoramaWidth, -55, {
            width = panoramaWidth,
            height = panoramaHeight,
            pivotX = 0,
            pivotY = 0,
        })
    end
end

function Renderer:drawPlatforms(game, visibleLeft, visibleRight)
    for _, platform in ipairs(game.level.platforms) do
        local intersectsView = platform.x < visibleRight and platform.x + platform.width > visibleLeft

        if intersectsView then
            local name = platform.height >= 100 and 'ground' or 'bridge'
            local artwork = Art.platform(name)

            -- The drawn top and dimensions match the physical platform exactly.
            graphics.drawNineSlice(artwork.slice, {
                platform.x,
                platform.y,
                platform.width,
                platform.height,
            }, '#FFFFFFFF', {borderScale = platform.height / artwork.sourceHeight})
        end
    end
end

function Renderer:drawProps(game, visibleLeft, visibleRight)
    for _, prop in ipairs(game.level.props) do
        if prop.x > visibleLeft - 100 and prop.x < visibleRight + 100 then
            Art.draw(prop.kind, prop.x, prop.y, {
                pivotX = 0.5,
                pivotY = 1,
                width = prop.kind == 'ruin' and 110 or 130,
            })
        end
    end

    -- Crate artwork follows its native body's position and rotation.
    for _, crate in ipairs(game.world.crates) do
        if crate.body.valid then
            Art.draw('crate', crate.body.x, crate.body.y, {
                width = 84,
                height = 84,
                rotation = crate.body.rotation,
                flash = crate.flash > 0 and '#A0FFFFFF' or '#00000000',
            })
        end
    end

    for _, chunk in ipairs(game.world.debris) do
        Art.draw('rock', chunk.body.x, chunk.body.y, {
            width = 18,
            height = 18,
            rotation = chunk.body.rotation,
        })
    end
end

function Renderer:drawObjectives(game)
    for _, relic in ipairs(game.relics) do
        if not relic.collected then
            local bob = math.sin(game.time * 3) * 6
            graphics.drawCircle(relic.x, relic.y, 48, '#20FFD65F', {blend = 'additive'})
            Art.draw('relic', relic.x, relic.y + bob, {width = 66})
        end
    end

    local gate = game.level.gate
    local portalOpen = game.relicCount == #game.relics and not game.boss.alive

    Art.draw('portal', gate.x, gate.y + 89, {
        width = 170,
        pivotY = 1,
        color = portalOpen and '#FFFFFFFF' or '#FF99A7A4',
    })

    -- Orbiting sparks communicate that the portal is ready without hiding the arch.
    if portalOpen then
        for index = 1, 12 do
            local angle = index * math.pi / 6 + game.time * 0.7
            local x = gate.x + math.cos(angle) * 52
            local y = gate.y + math.sin(angle) * 74
            graphics.drawCircle(x, y, 4, '#FFFFE39C', {blend = 'additive'})
        end
    end
end

function Renderer:drawWorld(game)
    graphics.beginWorld(game.camera)

    local visibleLeft = game.camera.position.x - 730
    local visibleRight = game.camera.position.x + 730

    self:drawPlatforms(game, visibleLeft, visibleRight)
    self:drawProps(game, visibleLeft, visibleRight)
    self:drawObjectives(game)

    for _, enemy in ipairs(game.enemies) do
        enemy:draw()
    end

    game.player:draw()
    game.combat:draw()
    game.effects:draw()
end

function Renderer:draw(game)
    self:drawBackground(game)
    self:drawWorld(game)
    Hud.draw(game)
end

return Renderer
