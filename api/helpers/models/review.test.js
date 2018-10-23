const mongoose = require('mongoose');
mongoose.Promise  = global.Promise;
const Review = require('./review');
const Application = require('./application');
const User = require('./user');

describe('Review', () => {
    describe('_addedBy', () => {
        test('it references a user', () => {
            let jordan = new User({username: 'Jordan', password: 'likescoff33'});
            let review = new Review({_addedBy: jordan.id});

            review.save((error) => {
                expect(error).toBeUndefined();
            });
            expect(review._addedBy).toEqual(jordan.id);
        });
    });

    describe('_applications', () => {
        test('it references many applications', () => {
            let skiResort = new Application({name: 'Amazing new resort'});
            let bikeShed = new Application({name: 'Boring bike shed'});
            let review = new Review({_applications: [skiResort.id, bikeShed.id]});

            review.save((error) => {
                expect(error).toBeUndefined();
            });
            expect(review._applications).toContain(skiResort.id, bikeShed.id);
        });
    });
});