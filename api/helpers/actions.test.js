const actions   = require('./actions');
const Organization = require('./models/organization');

describe('#publish', () => {
    describe('with an object that has already been published', () => {
        test('it returns 409 with a status message', done => {
            let publishedOrg = new Organization({tags: ['public']});
            actions.publish(publishedOrg)
            .catch(error => {
                expect(error.code).toEqual(409);
                expect(error.message).toEqual('Object already published');
                done();
            });
        });
    });

    describe('with an object that has not been published', () => {
        test('it adds the public tag and saves it', () => {
            let newOrg = new Organization({tags: []});
            actions.publish(newOrg);
            expect(newOrg.tags[0]).toEqual(expect.arrayContaining(['public']));
        });
    });
});

test('Testing publish.', () => {
    var o = {};
    o.tags = [['sysadmin']];

    expect(actions.isPublished(o)).toEqual(undefined);

    o.tags = [['sysadmin'], ['public']];
    expect(actions.isPublished(o)).toEqual(['public']);
});

describe('#isPublished', () => {
    let organization = new Organization({});

    test('it returns the array of public tags', () => {
        organization.tags = [['sysadmin'], ['public']];
        expect(actions.isPublished(organization)).toEqual(expect.arrayContaining(['public']));
    });

    test('it returns undefined if there is no matching public tag', () => {
        organization.tags = [['sysadmin']];
        expect(actions.isPublished(organization)).toBeUndefined();
    });
});

describe('#unpublish', () => {
    describe('with an object that has been published', () => {
        test('it removes the public tag and saves it', () => {
            let publishedOrg = new Organization({tags: ['public']});
            actions.unPublish(publishedOrg)
            expect(publishedOrg.tags).toHaveLength(0)
        });
    });

    describe('with an object that is unpublished', () => {
        test('it returns 409 with a status message', done => {
            let newOrg = new Organization({tags: []});
            actions.unPublish(newOrg)
            .catch(error => {
                expect(error.code).toEqual(409);
                expect(error.message).toEqual('Object already unpublished');
                done();
            });
        });
    });
});

describe('#delete', () => {
    test('it removes the public tag', () => {
        let publishedOrg = new Organization({tags: ['public']});
        actions.delete(publishedOrg);
        expect(publishedOrg.tags).toHaveLength(0);
    });

    test('it soft-deletes the object', () => {
        let newOrg = new Organization({tags: []});
        actions.delete(newOrg);
        expect(newOrg.isDeleted).toEqual(true);
    });
});
