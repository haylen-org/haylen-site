-- A request for a new password: the email address, and the answer of the service under the button.
local haylen = require('haylen')
local http = require('http')
local scene = require('haylen.scene')
local ui = require('haylen.ui')

local Accounts = require('services.accounts')
local Forms = require('widgets.forms')
local Page = require('page')

local ResetPassword = haylen.class('ResetPassword', Page)

function ResetPassword:tree()
    self.fields = {email = ''}
    return Forms.layout('Let’s get you back in.', 'Enter your email address to reset your password.', {
        Forms.field(self, 'email', 'Email address', 'email', true),
        ui.button{id = 'submit', text = 'Request reset link', variant = 'primary', align = 'stretch', onClick = function()
            self:submit()
        end},
        ui.label{id = 'confirmation', visible = false, text = '', color = 'successText'},
        ui.button{text = 'Back to sign in', variant = 'link', align = 'center', onClick = ui.goBack},
    }, true)
end

function ResetPassword:submit()
    if self.submitting or not Forms.check(self, {
        {id = 'email', valid = Forms.email(self.fields.email), message = 'Enter an email address.'},
    }) then
        return
    end

    Forms.busy(self, true, 'Requesting…')
    self.gui:set('confirmation', {visible = false})
    scene.spawn(self, function()
        local request <close> = http.client.controller()
        local result, message = Accounts.resetPassword(self.fields.email, request)
        Forms.busy(self, false, 'Request another link')
        if not result then
            Forms.error(self, message)
            return
        end
        self.gui:set('confirmation', {text = result.message, visible = true})
    end)
end

return ResetPassword
