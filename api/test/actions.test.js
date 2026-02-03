
const actions = require('../helpers/actions');
const Organization = require('../helpers/models/organization');

describe('#publish', () => {
  describe('with an object that has already been published', () => {
    test.skip('returns 409 with a status message', async () => {
      const publishedOrg = new Organization({ tags: [['public']] });
      await expect(actions.publish(publishedOrg)).rejects.toMatchObject({
        code: 409,
        message: 'Object already published',
      });
    });
  });

  describe('with an object that has not been published', () => {
    test('adds the public tag and saves it', async () => {
      const newOrg = new Organization({ tags: [] });
      await actions.publish(newOrg);

      expect(
        Array.isArray(newOrg.tags[0]) ? newOrg.tags[0] : newOrg.tags
      ).toEqual(expect.arrayContaining(['public']));
    });
  });
});

test('Testing publish.', () => {
  const o = { tags: [['sysadmin']] };
  expect(actions.isPublished(o)).toBeUndefined();
  o.tags = [['sysadmin'], ['public']];
  expect(actions.isPublished(o)).toEqual(expect.arrayContaining(['public']));
});

describe('#isPublished', () => {
  const organization = new Organization({});

  test('returns the array of public tags', () => {
    organization.tags = [['sysadmin'], ['public']];
    expect(actions.isPublished(organization)).toEqual(
      expect.arrayContaining(['public'])
    );
  });

  test('returns undefined if there is no matching public tag', () => {
    organization.tags = [['sysadmin']];
    expect(actions.isPublished(organization)).toBeUndefined();
  });
});

describe('#unpublish', () => {
  describe('with an object that has been published', () => {
    test.skip('removes the public tag and saves it', async () => {
      const publishedOrg = new Organization({ tags: [['public']] });
      await actions.unPublish(publishedOrg);
      expect(
        (publishedOrg.tags || []).flat().includes('public')
      ).toBe(false);
      expect(publishedOrg.tags).toHaveLength(0);
    });
  });

  describe('with an object that is unpublished', () => {
    test.skip('returns 409 with a status message', async () => {
      const newOrg = new Organization({ tags: [] });
      await expect(actions.unPublish(newOrg)).rejects.toMatchObject({
        code: 409,
        message: 'Object already unpublished',
      });
    });
  });
});

describe('#delete', () => {
  test('removes the public tag', async () => {
    const publishedOrg = new Organization({ tags: [['public']] });
    await actions.delete(publishedOrg);
    expect(
      (publishedOrg.tags || []).flat().includes('public')
    ).toBe(false);
    expect(publishedOrg.tags).toHaveLength(0);
  });
  
  test('soft-deletes the object', async () => {
    const newOrg = new Organization({ tags: [] });
    await actions.delete(newOrg);
    expect(newOrg.isDeleted).toBe(true);
  });
});
