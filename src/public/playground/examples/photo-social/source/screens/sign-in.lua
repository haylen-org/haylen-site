-- The first screen of the sign-in flow: the email and the password of the demo account, prefilled, the way to create an account and the way to ask for a new password.
local haylen = require('haylen')
local http = require('http')
local scene = require('haylen.scene')
local ui = require('haylen.ui')

local Accounts = require('services.accounts')
local Forms = require('widgets.forms')
local Page = require('page')
local Style = require('style')

local SignIn = haylen.class('SignIn', Page)

function SignIn:tree()
    self.fields = {email = Accounts.demoEmail, password = Accounts.demoPassword}
    return Forms.layout('Welcome back.', 'Your people. Your moments. Pick up where you left off.', {
        Forms.field(self, 'email', 'Email address', 'email'),
        Forms.field(self, 'password', 'Password', 'password', true),
        ui.button{text = 'Forgot password?', variant = 'link', align = 'end', onClick = function()
            self.stack:push(require('screens.reset-password')())
        end},
        ui.button{id = 'submit', text = 'Sign in', variant = 'primary', align = 'stretch', onClick = function()
            self:submit()
        end},
        ui.row{gap = Style.space.xs, justify = 'center',
            ui.label{text = 'New here?', color = 'textMuted'},
            ui.button{text = 'Create an account', variant = 'link', onClick = function()
                self.stack:push(require('screens.sign-up')())
            end},
        },
        ui.label{text = 'This demo signs in through httpbin.org, a public service for testing HTTP requests. Use the demo account, never a real password.', font = 'caption', color = 'textMuted'},
    })
end

function SignIn:submit()
    if self.submitting then
        return
    end
    if not Forms.check(self, {
        {id = 'email', valid = Forms.email(self.fields.email), message = 'Enter an email address.'},
        {id = 'password', valid = #self.fields.password > 0, message = 'Enter your password.'},
    }) then
        return
    end

    Forms.busy(self, true, 'Signing in…')
    -- The task belongs to the screen, and the controller cancels the request when the task ends, such as when the screen leaves before the answer arrives.
    scene.spawn(self, function()
        local request <close> = http.client.controller()
        local result, message = Accounts.signIn(self.fields.email, self.fields.password, request)
        Forms.busy(self, false, 'Sign in')
        if not result then
            Forms.error(self, message)
            return
        end
        require('auth').finish(result.user)
    end)
end

return SignIn
