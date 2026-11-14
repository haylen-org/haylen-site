-- Welcome to Skybound, a tiny platform game made with Haylen.
-- Start with player.lua to change the movement. Edit level.json to build a level.
local assets = require('haylen.assets')
local input = require('haylen.input')
local scene = require('haylen.scene')

input.loadActions(assets.json('input.json'))
scene.push(require('game').new())
print('Welcome to Skybound! Move with arrows or A/D. Jump with Space.')
