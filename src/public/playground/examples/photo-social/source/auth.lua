-- The sign-in flow, a scene of its own beside the scene of the main app, since signing in and out changes the whole app rather than its middle. The scene mounts its frame once: a wide window shows a picture on one side, which stays still while the forms of the flow slide in a stack of their own beside it, and a phone shows the forms alone.
local graphics2d = require('haylen.graphics2d')
local scene = require('haylen.scene')
local ui = require('haylen.ui')
local viewport = require('haylen.viewport')

local Session = require('session')
local Shell = require('shell')
local Style = require('style')

local Auth = {}

Auth.scene = {}

-- The change between the sign-in flow and the main app, which covers the screen with the color of the window.
Auth.transition = {effect = 'fade', duration = 0.3, color = Style.color.paper}

function Auth.start()
    scene.push(Auth.scene)
end

function Auth.scene:enter()
    Auth.wide = nil
    Auth.gui = ui.mount(Auth.frame(), {owner = self, sharedFocus = true})
    Auth.adaptFrame()
    Auth.stack = ui.navigationStack{gui = Auth.gui, id = 'flow', root = require('screens.sign-in')(), owner = self}
end

function Auth.scene:update()
    Auth.adaptFrame()
end

function Auth.scene:render()
    graphics2d.beginScreen()
    graphics2d.drawRect(viewport.visibleRect(), ui.themeColor('window'))
end

-- Shows the picture beside the forms on a wide window.
function Auth.adaptFrame()
    local wide = Shell.width() >= Style.wideWidth
    if Auth.wide == wide then
        return
    end
    Auth.wide = wide
    Auth.gui:set('art', {visible = wide})
end

-- The frame: the picture with its line, and the area where the stack of the flow shows its forms.
function Auth.frame()
    local space = Style.space
    return ui.row{gap = 0, align = 'stretch',
        ui.column{id = 'art', visible = false, grow = 1, gap = space.m, padding = space.l, align = 'stretch',
            ui.image{image = 'photos/lake-sunrise.jpg', fit = 'cover', radius = Style.radius.card, grow = 1, align = 'stretch', accessibilityHidden = true},
            ui.label{text = 'Everyday moments. A world of inspiration.', font = 'caption', color = 'textMuted'},
        },
        ui.column{id = 'flow', grow = 1, gap = 0, align = 'stretch'},
    }
end

-- Opens the main app for the person who signed in. The app shows the optional greeting in a toast once its scene entered, since its messages belong to that scene.
function Auth.finish(user, greeting)
    Session.open(user)
    Shell.greeting = greeting
    scene.replace(Shell.scene, Auth.transition)
end

-- Leaves the main app for the sign-in flow.
function Auth.signOut()
    Session.close()
    scene.replace(Auth.scene, Auth.transition)
end

return Auth
