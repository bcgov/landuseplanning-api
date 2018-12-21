const mongoose = require('mongoose');
mongoose.Promise  = global.Promise;
const User = require('./user');


describe('User', () => {
    describe('username', () => {
        test('saves a valid username', () => {
            let user = new User({username: 'superuser@hotmail.com', password: 'Password1!'});
            user.save((error) => {
                expect(error.errors).toBeUndefined();
            });
            expect(user.username).toEqual('superuser@hotmail.com');
        });

        test('cannot be blank', () => {
            let blankUser = new User({username: null, password: ''});
            blankUser.save((error) => {
                expect(error.errors).toBeDefined();
                let usernameErrors = error.errors.username;
                expect(usernameErrors).toBeDefined();
                expect(usernameErrors.message).toEqual('Please fill in a username');
            });
        });

        test('downcases username', () => {
            let weirdCaps = new User({username: 'tOOmAnYCAps', password: 'Password1!'});
            weirdCaps.save((error) => {
                expect(error.errors).toBeUndefined();
            });
            expect(weirdCaps.username).toEqual('toomanycaps');
        });
    });

    describe('password', () =>{
        test('requires a password', () => {
            let blankPassword = new User({username: 'coolguy'});
            blankPassword.save(function(error) {
                let passwordErrors = error.errors.password;
                expect(passwordErrors).toBeDefined();
                expect(passwordErrors.message).toEqual('Please fill in a password');
            });
        });
    });
});