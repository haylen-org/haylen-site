local assets = require('haylen.assets')
local graphics = require('haylen.graphics2d')
local input = require('haylen.input')
local Player = require('player')
local Game = {}
Game.__index = Game

function Game.new()
    local self = setmetatable({}, Game)
    self.level = assets.json('level.json')
    self.hero = assets.vectorImage('hero.svg')
    self.tile = assets.vectorImage('tile.svg')
    self.coin = assets.vectorImage('coin.svg')
    self.cloud = assets.vectorImage('cloud.svg')
    self.enemy = assets.vectorImage('enemy.svg')
    self.flag = assets.vectorImage('flag.svg')
    self:reset()
    return self
end

function Game:reset()
    self.player = Player.new(80, 300)
    self.collected = {}
    self.score = 0
    self.time = 0
    self.camera = 0
    self.won = false
end

local function overlaps(a, b)
    return a.x < b.x + b.width and a.x + a.width > b.x
        and a.y < b.y + b.height and a.y + a.height > b.y
end

function Game:update(dt)
    dt = math.min(dt, 1 / 30)
    if input.keyPressed('r') then self:reset() end
    if self.won then return end
    self.time = self.time + dt
    self.player:update(dt, self.level.platforms)
    self.camera = math.max(0, math.min(self.level.width - 960, self.player.x - 360))
    if self.player.y > 620 then self:reset() end
    for index, coin in ipairs(self.level.coins) do
        if not self.collected[index] and overlaps(self.player, {x = coin.x, y = coin.y, width = 20, height = 20}) then
            self.collected[index] = true
            self.score = self.score + 1
            print('Coin collected! ' .. self.score .. ' / ' .. #self.level.coins)
        end
    end
    for _, enemy in ipairs(self.level.enemies) do
        local position = {x = enemy.x + math.sin(self.time * 1.4) * 45, y = enemy.y, width = 32, height = 24}
        if overlaps(self.player, position) then
            if self.player.vy > 100 and self.player.y + self.player.height < position.y + 14 then
                self.player.vy = -420
            else self:reset() end
        end
    end
    if self.player.x > self.level.width - 110 then
        self.won = true
        print('You reached the flag! Change the level, or press R to play again.')
    end
end

function Game:render()
    graphics.beginScreen()
    graphics.drawRect({x = 0, y = 0, width = 960, height = 540}, '#FF102C46')
    graphics.drawCircle(780, 90, 48, '#FFCCE6BB')
    for i = 0, 6 do
        local x = (i * 245 - self.camera * 0.22) % 1450 - 200
        graphics.drawVector(self.cloud, x, 80 + (i % 3) * 40, {pivotX = 0, pivotY = 0, width = 150, height = 48})
    end
    for i = 0, 10 do
        graphics.drawRect({x = i * 180 - self.camera * 0.35, y = 290 + (i % 3) * 28, width = 130, height = 300}, '#FF173F53')
        graphics.drawRect({x = i * 140 - self.camera * 0.55, y = 360 + (i % 2) * 35, width = 90, height = 220}, '#FF215463')
    end
    for _, platform in ipairs(self.level.platforms) do
        for x = platform.x, platform.x + platform.width - 1, 32 do
            graphics.drawVector(self.tile, x - self.camera, platform.y, {pivotX = 0, pivotY = 0})
        end
        graphics.drawRect({x = platform.x - self.camera, y = platform.y + 32, width = platform.width, height = 540}, '#FF304B50')
    end
    for index, coin in ipairs(self.level.coins) do
        if not self.collected[index] then
            graphics.drawVector(self.coin, coin.x - self.camera, coin.y + math.sin(self.time * 4 + index) * 4, {pivotX = 0, pivotY = 0, width = 20, height = 20})
        end
    end
    for _, enemy in ipairs(self.level.enemies) do
        graphics.drawVector(self.enemy, enemy.x + math.sin(self.time * 1.4) * 45 - self.camera, enemy.y, {pivotX = 0, pivotY = 0})
    end
    graphics.drawVector(self.flag, self.level.width - 90 - self.camera, 334, {pivotX = 0, pivotY = 0, width = 36, height = 114})
    graphics.drawVector(self.hero, self.player.x - self.camera, self.player.y, {pivotX = 0, pivotY = 0, width = 30, height = 40, flipHorizontal = self.player.facingLeft})
    graphics.drawRect({x = 20, y = 18, width = 260, height = 42}, '#CC0D2135')
    graphics.drawText(nil, 'SKYBOUND   /   ' .. self.score .. ' COINS', 34, 28, {size = 19, color = '#FFD4EEDA'})
    graphics.drawText(nil, 'R to restart', 800, 28, {size = 17, color = '#FF9ABDC8'})
    if self.won then
        graphics.drawRect({x = 190, y = 170, width = 580, height = 170}, '#EE0D2135')
        graphics.drawText(nil, 'YOU MADE IT!', 305, 202, {size = 38, color = '#FF9BE4C6'})
        graphics.drawText(nil, 'Now make this game your own. Press R to restart.', 225, 270, {size = 20})
    end
end

return Game
