-- A form stores its draft separately from its retained UI nodes.
local haylen = require('haylen')
local ui = require('haylen.ui')
local Api = require('services.fake-api')
local Forms = require('widgets.forms')
local Page = require('page')
local Session = require('session')
local Shell = require('shell')

local Login = haylen.class('PhotoSocialLogin', Page)

function Login:enter()
    self.authScreen = true
    self.fields = {email = 'alex@example.com', password = 'explore123'}
    self:mountGui(Forms.layout('Welcome back.', 'Your people. Your moments. Pick up where you left off.', {
        Forms.field(self, 'email', 'Email address', 'email'),
        Forms.field(self, 'password', 'Password', 'password'),
        ui.button{text = 'Forgot password?', variant = 'link', align = 'end', onClick = function()
            Shell.open(require('screens.reset-password'))
        end},
        ui.button{id = 'submit', text = 'Sign in', variant = 'primary', align = 'stretch', onClick = function()
            self:submit()
        end},
        ui.row{gap = 8, align = 'center',
            ui.label{text = 'New here?', color = 'textMuted'},
            ui.button{text = 'Create an account', variant = 'link', onClick = function()
                Shell.open(require('screens.signup'))
            end},
        },
    }))
end

function Login:submit()
    if self.submitting then
        return
    end
    if not Forms.check(self, {
        {id = 'email', valid = Forms.email(self.fields.email), message = 'Enter an email address.'},
        {id = 'password', valid = #self.fields.password > 0, message = 'Enter your password.'},
    }) then
        return
    end

    -- The same submission flow can call a real asynchronous API later.
    Forms.busy(self, true, 'Signing in…')
    Api.signIn(self.fields, self, function(result, message)
        Forms.busy(self, false, 'Sign in')
        if message then
            Forms.error(self, message)
            return
        end
        Session.open(result)
        Api.activate(result.user)
        Shell.showTab('home')
    end)
end

return Login
