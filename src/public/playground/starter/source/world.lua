-- This module owns the Box2D world and every terrain, crate and debris body.
local physics = require('haylen.physics2d')

local World = {}
World.__index = World

function World.new(level)
    local self = setmetatable({
        crates = {},
        debris = {},
        impulses = 0,
    }, World)

    self.physics = physics.newWorld({
        gravity = {0, 1900},
        pixelsPerMeter = 64,
        subSteps = 4,
        threads = 1,
        interpolate = true,
    })

    -- Static rectangles share the exact bounds used to draw the platforms.
    for _, platform in ipairs(level.platforms) do
        local body = self.physics:createBody({
            type = 'static',
            x = platform.x + platform.width / 2,
            y = platform.y + platform.height / 2,
        })
        body:addBox(platform.width, platform.height, {friction = 0.65, category = 1})
        body.data = {kind = 'terrain'}
    end

    -- Invisible side walls keep the hero inside the level without covering gaps.
    for _, x in ipairs({-40, level.width + 40}) do
        local wall = self.physics:createBody({type = 'static', x = x, y = 320})
        wall:addBox(80, 1200, {category = 1})
    end

    -- Dynamic crates can be pushed, hit, rotated and broken during play.
    for _, point in ipairs(level.crates) do
        local body = self.physics:createBody({
            x = point.x,
            y = point.y,
            angularDamping = 1.5,
        })
        body:addBox(84, 84, {
            density = 0.7,
            friction = 0.65,
            restitution = 0.12,
            category = 2,
        })

        local crate = {body = body, health = 3, flash = 0, kind = 'crate'}
        body.data = crate
        self.crates[#self.crates + 1] = crate
    end

    return self
end

function World:scatterDebris(x, y)
    -- These are short-lived physics bodies rather than decorative screen particles.
    for index = 1, 4 do
        local body = self.physics:createBody({
            x = x + (index % 2) * 18 - 9,
            y = y - 20,
            vx = (index - 2.5) * 120,
            vy = -180 - index * 35,
            angularVelocity = index - 2,
        })
        body:addBox(14, 14, {density = 0.3, friction = 0.5, category = 2, mask = 1})

        self.debris[#self.debris + 1] = {body = body, life = 1.8}
    end
end

function World:hitCrate(crate, direction, game)
    if not crate.body.valid or crate.health <= 0 then
        return
    end

    crate.health = crate.health - 1
    crate.flash = 0.12
    crate.body:applyImpulse(direction * 180, -50)
    self.impulses = self.impulses + 1

    if crate.health > 0 then
        return
    end

    local x = crate.body.x
    local y = crate.body.y
    crate.body:destroy()

    -- The radial impulse affects nearby crates in collision category 2.
    physics.explode(self.physics, {x = x, y = y, radius = 240, impulse = 320, mask = 2})
    self:scatterDebris(x, y)
    game.effects:burst(x, y, 45, true)
    game.camera:addTrauma(0.28)
    game.sound:play('blast')
end

function World:step(deltaTime)
    self.physics:step(deltaTime)

    for _, crate in ipairs(self.crates) do
        crate.flash = math.max(0, crate.flash - deltaTime)

        if crate.body.valid and crate.body.y > 1100 then
            crate.body:destroy()
        end
    end

    -- Iterate backwards because removing an expired item changes array indices.
    for index = #self.debris, 1, -1 do
        local chunk = self.debris[index]
        chunk.life = chunk.life - deltaTime

        if chunk.life <= 0 then
            chunk.body:destroy()
            table.remove(self.debris, index)
        end
    end
end

function World:destroy()
    -- Release native resources on retry and when the scene leaves the stack.
    self.physics:destroy()
    self.crates = {}
    self.debris = {}
end

return World
