-- The base of every screen: it paints the background of the theme, mounts the GUI of the screen and follows the width of the window.
local graphics2d = require('haylen.graphics2d')
local haylen = require('haylen')
local scene = require('haylen.scene')
local ui = require('haylen.ui')
local viewport = require('haylen.viewport')

local Shell = require('shell')

local Page = haylen.class('Page', scene.Scene)

function Page:init(params)
    self.params = params or {}
end

-- Mounts the tree of the screen. Every screen shares the focus with the GUIs of the app, so a remote reaches the notices and back.
function Page:mountGui(tree, options)
    local left, bottom = Shell.insets(self)
    tree.grow = 1
    tree.align = 'stretch'
    tree.onCancel = tree.onCancel or Shell.back
    -- Reserve the shared menu's area without mounting another menu in this scene.
    self.gui = ui.mount(ui.row{gap = 0,
        ui.spacer{id = 'shell-left-inset', width = left},
        ui.column{grow = 1, gap = 0, align = 'stretch',
            tree,
            ui.spacer{id = 'shell-bottom-inset', height = bottom},
        },
    }, {owner = self, sharedFocus = true, placement = options and options.placement})
    self.wide, self.roomy = nil, nil
    Shell.adapt(self)
end

function Page:update(dt)
    Shell.adapt(self)
end

function Page:render()
    graphics2d.beginScreen()
    graphics2d.drawRect(viewport.visibleRect(), ui.themeColor('window'))
end

return Page
