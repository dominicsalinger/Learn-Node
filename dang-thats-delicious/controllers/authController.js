const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'Failed login',
    successRedirect: '/',
    successFlash: 'You are now logged in!'
});

exports.logout = (req, res) => {
    req.logout();
    req.flash('success', 'You are now loged out!');
    res.redirect('/');
}

exports.isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'You must be logged in to do that');
    res.redirect('/login');
};

exports.forgot = async (req, res, next) => {
    // see if user exists
    user = await User.findOne({ email: req.body.email });
    if (!user) {
        req.flash('success', `You have been emailed a password reset link`);
        return res.redirect('/login');
    }

    // set reset and expiry tokens in user account
    user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // one hour from now this expires
    await user.save();

    // send emails
    const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;

    // send reset email
    await mail.send({
        user, 
        subject: 'Password Reset',
        resetURL,
        filename: 'password-reset'
    });

    req.flash('success', `You have been emailed a password reset link`);
    res.redirect('/login');
};

exports.reset = async (req, res) => {
    const user = await User.findOne({ 
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() } 
    });
    if (!user) {
        req.flash('error', 'Password reset is invalid or has expired');
        return res.redirect('/login');
    }

    // if there is a user, show the reset password form
    res.render('reset', { title: 'Reset your Password' });
};

exports.confirmedPasswords = (req, res, next) => {
    if (req.body.password === req.body['password-confirm']) {
        return next();
    }
    req.flash('error', 'Passwords do not match!');
    res.redirect('back');
};

// updates the user's password
exports.update = async (req, res) => {
    const user = await User.findOne({ 
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() } 
    });
    if (!user) {
        req.flash('error', 'Password reset is invalid or has expired');
        return res.redirect('/login');
    }
    const setPassword = promisify(user.setPassword, user);
    await setPassword(req.body.password);
    user.resetPasswordExpires = undefined;
    user.resetPasswordToken = undefined;
    const updatedUser = await user.save();
    await req.login(updatedUser);
    req.flash('success', 'Your password has been reset, you are now logged in!');
    res.redirect('/');
};