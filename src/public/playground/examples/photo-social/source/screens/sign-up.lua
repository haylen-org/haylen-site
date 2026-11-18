-- A new account: the name, the email and a password typed twice. The account opens the app at once, with a toast that welcomes the person.
local haylen = require('haylen')
local http = require('http')
local scene = require('haylen.scene')
local ui = require('haylen.ui')

local Accounts = require('services.accounts')
local Forms = require('widgets.forms')
local Page = require('page')

local SignUp = haylen.class('SignUp', Page)

function SignUp:tree()
    self.fields = {name = '', email = '', password = '', confirm = ''}
    return Forms.layout('A new place to start.', 'Create a demo account to share your moments.', {
        Forms.field(self, 'name', 'Your name'),
        Forms.field(self, 'email', 'Email address', 'email'),
        Forms.field(self, 'password', 'Create a password', 'password'),
        Forms.field(self, 'confirm', 'Confirm password', 'password', true),
        ui.button{id = 'submit', text = 'Create account', variant = 'primary', align = 'stretch', onClick = function()
            self:submit()
        end},
        ui.button{text = 'Already have an account? Sign in', variant = 'link', align = 'center', onClick = ui.goBack},
    }, true)
end

function SignUp:submit()
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
    scene.spawn(self, function()
        local request <close> = http.client.controller()
        local result, message = Accounts.signUp(self.fields, request)
        Forms.busy(self, false, 'Create account')
        if not result then
            Forms.error(self, message)
            return
        end
        require('auth').finish(result.user, 'Your account is ready.')
    end)
end

return SignUp
