local haylen = require('haylen')
local ui = require('haylen.ui')
local Api = require('services.fake-api')
local Forms = require('widgets.forms')
local Page = require('page')
local Session = require('session')
local Shell = require('shell')

local Signup = haylen.class('PhotoSocialSignup', Page)

function Signup:enter()
    self.authScreen = true
    self.fields = {name = '', email = '', password = '', confirm = ''}
    self:mountGui(Forms.layout('A new place to start.', 'Create a demo account to save places and plan trips.', {
        Forms.field(self, 'name', 'Your name'),
        Forms.field(self, 'email', 'Email address', 'email'),
        Forms.field(self, 'password', 'Create a password', 'password'),
        Forms.field(self, 'confirm', 'Confirm password', 'password'),
        ui.button{id = 'submit', text = 'Create account', variant = 'primary', align = 'stretch', onClick = function()
            self:submit()
        end},
        ui.button{text = 'Already have an account? Sign in', variant = 'link', align = 'center', onClick = Shell.back},
    }))
end

function Signup:submit()
    if self.submitting then
        return
    end
    if not Forms.check(self, {
        {id = 'name', valid = self.fields.name:match('%S') ~= nil, message = 'Enter your name.'},
        {id = 'email', valid = Forms.email(self.fields.email), message = 'Enter an email address.'},
        {id = 'password', valid = #self.fields.password >= 8, message = 'Use at least 8 characters.'},
        {id = 'confirm', valid = self.fields.confirm == self.fields.password, message = 'The passwords do not match.'},
    }) then
        return
    end

    Forms.busy(self, true, 'Creating account…')
    Api.signUp(self.fields, self, function(result, message)
        Forms.busy(self, false, 'Create account')
        if message then
            Forms.error(self, message)
            return
        end
        Session.open(result)
        Api.activate(result.user)
        Shell.showTab('home')
        Shell.notify('Your account is ready.', 'success')
    end)
end

return Signup
