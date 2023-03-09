### 1.7.0 Mar 9, 2023
* Added option to add/remove Activities and Updates section from project description page. [DESENG-283](https://apps.itsm.gov.bc.
ca/jira/browse/DESENG-283)

### 1.6.3 Dec 21, 2022
* Update CHES auth and API endpoints [DESENG-237](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-237)

### 1.6.2 Oct 12, 2022
* Banner image not loading on frontend [DESENG-181](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-181)
* Banner image not deleting [DESENG-182](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-182)

### 1.6.1 Oct 3, 2022
* Fix documents not loading [DESENG-197](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-197)

### 1.6.0 Sep 13, 2022
* Move from keycloak to Common Online SSO [DESENG-179](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-179)

### 1.5.1 May 25, 2022
* Remove unused nconf package [DESENG-135](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-135)

### 1.5.0 May 24, 2022
* Add ability to retrieve documents by documentSource [DESENG-4](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-4)

### 1.4.0 April 11, 2022
* Improve logging [DESENG-64](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-64)

### 1.3.0 March 23, 2022
* Fix email subscribe confirmation bug [DESENG-96](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-96)
* Add selective logging [DESENG-64](https://apps.itsm.gov.bc.ca/jira/browse/DESENG-64)
* Tree-shake lodash dependencies
* Update "var" -> "const" in app.js
* Remove unused code

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
