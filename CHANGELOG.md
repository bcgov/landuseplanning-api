### 1.2.3 March 17, 2022
* Fix document text search bug [DESENG-90](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-90)

### 1.2.2 March 4, 2022
* Resolve "useFindAndModify" deprecation warning [DESENG-65](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-65)

### 1.2.1 February 11, 2022
* Added OpenShift templates for the API pipeline
* Added github workflow for linting and tests
* added nightly backup scripts (DESENG-68)

### 1.1.0 January 26, 2022
* Tree shaking lodash dependencies
* Remove unnecessary console.log calls
* Graceful error handling for some methods
* Add details and engagementLabel fields to projects.
* Add better comments
* Update some methods with ES6 syntax.
* Remove unused function params, libraries, variables, etc.
* Remove old, commented-out code.
* Add CODEOWNERS file to trigger automatic reviewer requests
* Add node engine requirements for local installs
* Add beginning of linting tools
* Only use JS that is compatible with node ^10.0.0
* Add support for project logos
* Add support for document alt tags

### 1.0.1: November 16, 2021
* Updating version in package.json
* security update Force validator 13.7.0 via resolution (LUP-251)
* adding nodeman for server restart when files change. npm run start-watch (LUP-249)
