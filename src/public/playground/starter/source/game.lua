-- The scene connects the simulation, presentation and mission state.
local assets = require('haylen.assets')
local input = require('haylen.input')
local graphics = require('haylen.graphics2d')
local Player = require('player')
local World = require('world')
local Enemy = require('enemy')
local Combat = require('combat')
local Effects = require('effects')
local Sound = require('sound')
local Renderer = require('renderer')
local Controls = require('touch-controls')

local Game = {}
Game.__index = Game

function Game.new()
    return setmetatable({}, Game)
end

function Game:load()
    self.level = assets.json('level.json')
    self.renderer = Renderer.new()
    self.sound = Sound.new()
    self:reset()
end

function Game:reset()
    -- Destroy the previous native world before replacing its actors on retry.
    if self.world ~= nil then
        self.world:destroy()
    end

    if self.effects ~= nil then
        self.effects:clear()
    end

    self.world = World.new(self.level)
    self.effects = Effects.new()
    self.controls = Controls.new()
    self.player = Player.new(self.world.physics, self.level.spawn)
    self.combat = Combat.new(self)

    self.camera = graphics.newCamera()
    self.camera.position = {640, 360}
    self.camera.positionSmoothing = true
    self.camera.positionSmoothingSpeed = 5
    self.camera.limits = {0, 0, self.level.width, 720}
    self.camera.maxShakeOffset = 16
    self.camera.maxShakeAngle = 0.012

    self.enemies = {}
    self.boss = nil

    for _, point in ipairs(self.level.enemies) do
        local enemy = Enemy.new(self.world.physics, point)
        self.enemies[#self.enemies + 1] = enemy

        if enemy.boss then
            self.boss = enemy
        end
    end

    assert(self.boss ~= nil, 'The level needs a guardian with kind = brute.')

    self.relics = {}

    for _, point in ipairs(self.level.relics) do
        self.relics[#self.relics + 1] = {x = point.x, y = point.y, collected = false}
    end

    self.state = 'playing'
    self.time = 0
    self.kills = 0
    self.relicCount = 0
end

function Game:enter()
    print('Emberfall ready. A/D move. Space jumps. X/J or click attacks. Mouse or arrows aim.')
    print('Shift dashes. 1/2/3 or C changes hero. R restarts. M toggles sound.')
    print('Gamepad: left stick or D-pad moves. Right stick aims. Bottom button jumps.')
    print('Right trigger or left face button attacks. Right face button dashes. Top button changes hero.')
end

function Game:damage(amount)
    if self.state ~= 'playing' or self.player.invulnerable > 0 then
        return
    end

    self.player.health = math.max(0, self.player.health - amount)
    self.player.invulnerable = 1

    self.effects:burst(self.player.x, self.player.y, 20)
    self.camera:addTrauma(0.3)
    self.sound:play('hit')

    if self.player.health == 0 then
        self.state = 'failed'
        print('The quest continues. Press R to try again.')
    end
end

function Game:update(deltaTime)
    self.controls:update(deltaTime)
    -- Frame updates read controls and animate artwork without stepping physics.
    if input.pressed('sound') then
        self.sound.muted = not self.sound.muted
    end

    local retryFromResult = self.state ~= 'playing' and input.pressed('jump')

    if input.pressed('retry') or retryFromResult then
        self:reset()
    end

    self.time = self.time + deltaTime

    if self.state == 'playing' then
        self.player:readInput(self.camera, self.controls)
    end

    self.player:update(deltaTime, self)

    for _, enemy in ipairs(self.enemies) do
        enemy:update(deltaTime)
    end

    local lookAhead = self.player.facing * 110
    self.camera:follow(self.player.x + lookAhead, 360, deltaTime)
    self.camera:update(deltaTime)
    self.effects:update(deltaTime, self.camera)
end

function Game:collectRelics()
    for _, relic in ipairs(self.relics) do
        local differenceX = self.player.x - relic.x
        local differenceY = self.player.y - relic.y
        local distanceSquared = differenceX * differenceX + differenceY * differenceY

        if not relic.collected and distanceSquared < 90 * 90 then
            relic.collected = true
            self.relicCount = self.relicCount + 1
            self.player.health = math.min(5, self.player.health + 1)

            self.effects:burst(relic.x, relic.y, 45)
            self.sound:play('relic')
            print('Relic found: ' .. self.relicCount .. ' / ' .. #self.relics)
        end
    end
end

function Game:checkPortal()
    local allRelicsFound = self.relicCount == #self.relics
    local guardianDefeated = not self.boss.alive
    local nearPortal = math.abs(self.player.x - self.level.gate.x) < 80

    if allRelicsFound and guardianDefeated and nearPortal then
        self.state = 'won'
        self.effects:burst(self.level.gate.x, self.level.gate.y, 100, true)
        print('Quest complete. All relics found. The portal is open.')
    end
end

function Game:fixedUpdate(deltaTime)
    if self.state ~= 'playing' then
        return
    end

    -- Fixed steps keep movement, hit detection and rigid bodies on one timeline.
    self.player:step(deltaTime, self)

    for _, enemy in ipairs(self.enemies) do
        enemy:step(deltaTime, self)
    end

    self.combat:step(deltaTime)
    self.world:step(deltaTime)

    -- Falling through a gap ends the run even during dash invulnerability.
    if self.player.y > 1000 then
        self.player.invulnerable = 0
        self:damage(5)
    end

    if self.state ~= 'playing' then
        return
    end

    self:collectRelics()
    self:checkPortal()
end

function Game:render()
    self.renderer:draw(self)
    self.controls:draw()
end

function Game:unload()
    input.clearVirtual()
    if self.effects ~= nil then
        self.effects:clear()
    end

    if self.world ~= nil then
        self.world:destroy()
    end
end

return Game
