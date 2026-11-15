local haylen = require('haylen')
local ui = require('haylen.ui')
local Api = require('services.fake-api')
local Forms = require('widgets.forms')
local Page = require('page')
local Shell = require('shell')

local ResetPassword = haylen.class('PhotoSocialResetPassword', Page)

function ResetPassword:enter()
    self.authScreen = true
    self.fields = {email = ''}
    self:mountGui(Forms.layout('Let’s get you back in.', 'Enter your email address to reset your password.', {
        Forms.field(self, 'email', 'Email address', 'email'),
        ui.button{id = 'submit', text = 'Request reset link', variant = 'primary', align = 'stretch', onClick = function()
            self:submit()
        end},
        ui.label{id = 'confirmation', visible = false, text = '', color = 'successText'},
        ui.button{text = 'Back to sign in', variant = 'link', align = 'center', onClick = Shell.back},
    }))
end

function ResetPassword:submit()
    if self.submitting or not Forms.check(self, {
        {id = 'email', valid = Forms.email(self.fields.email), message = 'Enter an email address.'},
    }) then
        return
    end

    Forms.busy(self, true, 'Requesting…')
    Api.resetPassword(self.fields.email, self, function(result)
        Forms.busy(self, false, 'Request another link')
        self.gui:set('confirmation', {text = result.message, visible = true})
    end)
end

return ResetPassword
