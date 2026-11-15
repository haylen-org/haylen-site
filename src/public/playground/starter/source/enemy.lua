-- Enemies patrol their platform and aim magic at the hero when in range.
local Sprites = require('sprites')

local Enemy = {}
Enemy.__index = Enemy

function Enemy.new(world, point)
    local isBoss = point.kind == 'brute'
    local health = isBoss and 24 or 4
    local self = setmetatable({
        x = point.x,
        y = point.y,
        originX = point.x,
        patrolDirection = -1,
        moving = false,
        health = health,
        maxHealth = health,
        alive = true,
        kind = 'enemy',
        boss = isBoss,
        flash = 0,
        attackTimer = 1.4 + (point.x % 100) / 100,
        attackPose = 0,
        facing = -1,
        sprite = Sprites.character(point.kind, 0.82),
    }, Enemy)

    -- Kinematic bodies follow the patrol while still participating in ray casts.
    self.body = world:createBody({type = 'kinematic', x = point.x, y = point.y})
    self.body:addBox(isBoss and 125 or 72, isBoss and 180 or 88, {category = 4})
    self.body.data = self

    return self
end

function Enemy:step(deltaTime, game)
    if not self.alive then
        return
    end

    self.flash = math.max(0, self.flash - deltaTime)
    self.attackPose = math.max(0, self.attackPose - deltaTime)
    self.attackTimer = self.attackTimer - deltaTime

    self.moving = self.attackPose <= 0

    if self.moving then
        local patrolDistance = self.boss and 90 or 48
        local speed = self.boss and 55 or 42
        self.x = self.x + self.patrolDirection * speed * deltaTime

        if self.x <= self.originX - patrolDistance then
            self.x = self.originX - patrolDistance
            self.patrolDirection = 1
        elseif self.x >= self.originX + patrolDistance then
            self.x = self.originX + patrolDistance
            self.patrolDirection = -1
        end

        -- Face the direction of travel rather than tracking the hero while walking.
        self.facing = self.patrolDirection
    end

    self.body.position = {self.x, self.y}

    local differenceX = game.player.x - self.x
    local differenceY = game.player.y - 20 - self.y
    local distance = math.sqrt(differenceX * differenceX + differenceY * differenceY)

    if self.attackTimer <= 0 and distance < 880 then
        self:attack(game, differenceX, differenceY)
    end

    if distance < (self.boss and 105 or 75) then
        game:damage(1)
    end
end

function Enemy:attack(game, differenceX, differenceY)
    self.attackTimer = self.boss and 1.1 or 2.2
    self.attackPose = 0.3
    self.moving = false
    self.facing = differenceX < 0 and -1 or 1
    self.sprite:attack(self.attackPose)

    -- The brute fires a three-projectile fan. An imp fires one aimed projectile.
    local aimAngle = math.atan(differenceY, differenceX)
    local projectileCount = self.boss and 3 or 1

    for index = 1, projectileCount do
        local spread = (index - (projectileCount + 1) / 2) * 0.18
        local angle = aimAngle + spread

        game.combat:fire(self.x, self.y, math.cos(angle), math.sin(angle), true, 'fireball')
    end
end

function Enemy:update(deltaTime)
    if not self.alive then
        return
    end

    local animation = 'idle'

    if self.attackPose > 0 then
        animation = 'attack'
    elseif self.moving then
        animation = 'run'
    end
    self.sprite:update(deltaTime, animation)
end

function Enemy:hit(game, damage)
    if not self.alive then
        return
    end

    self.health = math.max(0, self.health - (damage or 1))
    self.flash = 0.1

    if self.health > 0 then
        return
    end

    self.alive = false
    self.body:destroy()
    game.kills = game.kills + 1

    game.effects:burst(self.x, self.y, self.boss and 100 or 38, true)
    game.camera:addTrauma(self.boss and 0.55 or 0.2)
    game.sound:play('blast')

    if self.boss then
        print('The guardian has fallen. Collect the relics and reach the portal.')
    end
end

function Enemy:draw()
    if not self.alive then
        return
    end

    local flash = self.flash > 0 and '#FFFFFFFF' or '#00000000'
    self.sprite:draw(self.x, self.y, self.facing, flash)
end

return Enemy
