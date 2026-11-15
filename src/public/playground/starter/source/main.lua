-- Emberfall is an editable platform game using Haylen's public Lua APIs.
-- The scene connects the focused movement, combat, physics and rendering modules.
local assets = require('haylen.assets')
local input = require('haylen.input')
local scene = require('haylen.scene')
local Game = require('game')

-- Named actions share keyboard, gamepad and project-owned touch controls.
input.loadActions(assets.json('input.json'))
input.setTouchAsMouse(false)

-- Haylen calls the scene's load, update, fixedUpdate, render and unload methods.
scene.push(Game.new())
