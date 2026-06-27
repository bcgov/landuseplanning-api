### Jun 26, 2026
* Removed publishing/visibility updates on protected document put. These are handled outside of form submission.

### Apr 29, 2026
* Modified app.js to add authSource.

### Apr 24, 2026
* Added an additional field to comment period objects for external tool popup URL [DESENG-959](https://citz-gdx.atlassian.net/browse/DESENG-959)
* Fixed some minor issues with unit testing environment (individual tests still need to be fixed)

### Apr 9, 2026
* Added additional YAMLs for MongoDB 3 PVCs and services that were not previously documented [DESENG-800](https://citz-gdx.atlassian.net/browse/DESENG-800)
* Organized openshift templates folder

### Mar 20, 2026
* Added YAMLs for prod environment MongoDB 6 configuration [DESENG-800](https://citz-gdx.atlassian.net/browse/DESENG-800)

### Feb 20, 2026
* Added YAMLs for test environment MongoDB 6 configuration [DESENG-800](https://citz-gdx.atlassian.net/browse/DESENG-800)

### Feb 2, 2026
* Modernized the API to meet MongoDB and Mongoose Requirements [DESENG-800](https://citz-gdx.atlassian.net/browse/DESENG-800)
    * Updated target MongoDB version to 6.0.13
    * Updated Mongoose to version 6.13.8
        * Refactored any code that was using deprecated Mongoose methods or patterns
    * Changed all Node version references to version 18
    * Restored unit test functionality, unit tests will need to be remade
    * Modernized code to es2017 standards
        * Replaced .then with async/await
        * Streamlined object creation with direct property assignments
        * Replaced var with let and const
        * Other misc syntax updates
    * Fixed several errors in swagger.yaml, including duplicate keys and missing tags
    * Applied basic prettier formatting to files for easier readability
    * Tested and fixed any broken API logic after upgrade
    * Updated DB folder with new docker-compose.yaml and left Mongo 3.6 docker-compose for backup purposes
        * Updated README.md file with local db upgrade instructions
    * Updated server responses to filter out error data for security
    * Updated several catch blocks with bespoke error messages
    * Standardized and protected error logging
    * Implemented db migration for email index unique bug
        * Email property is now unique for documents with _schemaName: EmailSubscribe
        * Email property is not unique for documents with _schemaName: User

### Nov 13, 2025
* Add dynamic sitemap generation for projects and comment periods [DESENG-917](https://citz-gdx.atlassian.net/browse/DESENG-917)
    * New endpoint at `/api/sitemap_dynamic.xml` (linked by reference from `/sitemap.xml` on the webapp side)
    * Includes all publicly accessible projects and published comment periods
    * Automatically generated from the database with relevant SEO metadata

### Nov 5, 2025
* Update email subscribe confirmation ([DESENG-921](https://citz-gdx.atlassian.net/browse/DESENG-921))
    * Fix an issue where subscribing to multiple projects would create invalid confirmation links
    * Finish implementation of adding projects to existing confirmed subscriptions
    * Send "project added" email when a confirmed subscriber adds a new project
    * Update email templates to clarify what action the user is taking
    * Clean up existing code, comments, and logging in email.js and emailSubscribe.js

### Oct 31, 2025
* Added the ability to remove a user from the permissions list. [DESENG-881](https://citz-gdx.atlassian.net/browse/DESENG-881)

### Aug 26, 2025
* Fixed API state hang that prevents container restarts when a fatal error occurs. [DESENG-889](https://citz-gdx.atlassian.net/browse/DESENG-889)

### Aug 1, 2025
* Remove unused comment properties that were causing a crash when approving rejecting comments [DESENG-888](https://citz-gdx.atlassian.net/browse/DESENG-888)

### Jul 30, 2025
* Fix faulty async code leading to inconsistent email subscribe deletions. [DESENG-887](https://citz-gdx.atlassian.net/browse/DESENG-887)

### Jul 21, 2025
* Refactor email subscribe methods to prevent execution order bugs. [DESENG-873](https://citz-gdx.atlassian.net/browse/DESENG-873)
* Correct some spelling mistakes
* Remove unused log and give log more context

### Jun 23, 2025
* Add missing API_HOSTNAME env var to enable easy confirmation of email subscriptions. [DESENG-833](https://citz-gdx.atlassian.net/browse/DESENG-833)

### Jun 19, 2025
* Document the use of image tags in openshift Deployments. [DESENG-841](https://citz-gdx.atlassian.net/browse/DESENG-841)

### Jun 18, 2025
* Created graceful fallback for failure of Minio file open. [DESENG-831](https://citz-gdx.atlassian.net/browse/DESENG-831)

### Jun 17, 2025
* Resolve issue with missing authentication functions [DESENG-825](https://citz-gdx.atlassian.net/browse/DESENG-825)

### May 27, 2025
* Remove `npx` command to get around npm_config_prefix issue [DESENG-827](https://citz-gdx.atlassian.net/browse/DESENG-827)
* Correct incorrectly-called `sendResponse` call [DESENG-827](https://citz-gdx.atlassian.net/browse/DESENG-827)

### May 26, 2025
* Update Node to version 16 for `crypto` package compatibility [DESENG-827](https://citz-gdx.atlassian.net/browse/DESENG-827)
* Update to Node 18 to solve other dependency issues (`jwt-decode`) [DESENG-827](https://citz-gdx.atlassian.net/browse/DESENG-827)

### May 23, 2025
* Remove crypto package, unneeded utilities [DESENG-827](https://citz-gdx.atlassian.net/browse/DESENG-827)

### May 22, 2025
* Convert Minio DCs to Deployments [DESENG-782](https://citz-gdx.atlassian.net/browse/DESENG-782)
* Convert MongoDB DC to Deployment [DESENG-767](https://citz-gdx.atlassian.net/browse/DESENG-767)
* Backed up old and new yamls for production deployment [DESENG-767](https://citz-gdx.atlassian.net/browse/DESENG-767)
* Replaced outdated crypto package with native Node crypto functionality. [DESENG-827](https://citz-gdx.atlassian.net/browse/DESENG-827)

### Apr 23, 2025
* Add "shapefiles" property to projects [DESENG-769](https://citz-gdx.atlassian.net/browse/DESENG-769)

### Apr 16, 2025
* Removed optional chaining due to Node target version. [DESENG-789](https://citz-gdx.atlassian.net/browse/DESENG-789)
* Revised virus scanning logic for optimization.
* Added YAML templates for ClamAV service.

### Apr 14, 2025
* Added file attachment functionality to contact form email submission, and the ability for admins to enable/disable it. [DESENG-789](https://citz-gdx.atlassian.net/browse/DESENG-789)

### April 8, 2025
* Improve installation instructions and move dotenv installation source

### Mar 31, 2025
* Modified search controller to accomodate custom project type sorting. [DESENG-786](https://citz-gdx.atlassian.net/browse/DESENG-786)
* Update installation instructions & process [DESENG-792](https://citz-gdx.atlassian.net/browse/DESENG-792)

### Mar 27, 2025
* Added new and updated pipeline and listener YAMLs, and basic health check route. [DESENG-778](https://citz-gdx.atlassian.net/browse/DESENG-778)

### Feb 26, 2025
* Updated keycloak-js to version 25.0.6. [DESENG-772](https://citz-gdx.atlassian.net/browse/DESENG-772)

### Feb 25, 2025
* Added old and new YAML files for dev deployment to openshift folder. [DESENG-759](https://citz-gdx.atlassian.net/browse/DESENG-759)
* Added old and new YAML files for dev MongoDB deployment to openshift folder. [DESENG-760](https://citz-gdx.atlassian.net/browse/DESENG-760)
* Added old and new YAML files for test api deployment and test MongoDB deployment to openshift folder. [DESENG-766](https://citz-gdx.atlassian.net/browse/DESENG-766)

### Feb 6, 2025
* Resolve unique index issue in local development

### Jan 9, 2025
* Added external link model, service, and swagger definitions. Modified search service. [DESENG-751](https://citz-gdx.atlassian.net/browse/DESENG-751)

### Nov 26, 2024
* Modified project definition to accomodate shape file colours. [DESENG-743](https://citz-gdx.atlassian.net/browse/DESENG-743)
* Modified project definition to accomodate project type multiselect. [DESENG-745](https://citz-gdx.atlassian.net/browse/DESENG-745)
* Modified project definition to accomodate custom collection notice. [DESENG-747](https://citz-gdx.atlassian.net/browse/DESENG-747)

### Mar 11, 2024
* Add option for contact form on projects [DESENG-373](https://citz-gdx.atlassian.net/browse/DESENG-373)

### Oct 11, 2023
* Add file sections [DESENG-372](https://citz-gdx.atlassian.net/browse/DESENG-372)

### Mar 9, 2023
* Added option to add/remove Activities and Updates section from project description page. [DESENG-283](https://citz-gdx.atlassian.net/browse/DESENG-283)

### Dec 21, 2022
* Update CHES auth and API endpoints [DESENG-237](https://citz-gdx.atlassian.net/browse/DESENG-237)

### Oct 12, 2022
* Banner image not loading on frontend [DESENG-181](https://citz-gdx.atlassian.net/browse/DESENG-181)
* Banner image not deleting [DESENG-182](https://citz-gdx.atlassian.net/browse/DESENG-182)

### Oct 3, 2022
* Fix documents not loading [DESENG-197](https://citz-gdx.atlassian.net/browse/DESENG-197)

### Sep 13, 2022
* Move from keycloak to Common Online SSO [DESENG-179](https://citz-gdx.atlassian.net/browse/DESENG-179)

### May 25, 2022
* Remove unused nconf package [DESENG-135](https://citz-gdx.atlassian.net/browse/DESENG-135)

### May 24, 2022
* Add ability to retrieve documents by documentSource [DESENG-4](https://citz-gdx.atlassian.net/browse/DESENG-4)

### April 11, 2022
* Improve logging [DESENG-64](https://citz-gdx.atlassian.net/browse/DESENG-64)

### March 23, 2022
* Fix email subscribe confirmation bug [DESENG-96](https://citz-gdx.atlassian.net/browse/DESENG-96)
* Add selective logging [DESENG-64](https://citz-gdx.atlassian.net/browse/DESENG-64)
* Tree-shake lodash dependencies
* Update "var" -> "const" in app.js
* Remove unused code

### March 17, 2022
* Fix document text search bug [DESENG-90](https://citz-gdx.atlassian.net/browse/DESENG-90)

### March 4, 2022
* Resolve "useFindAndModify" deprecation warning [DESENG-65](https://citz-gdx.atlassian.net/browse/DESENG-65)

### February 11, 2022
* Added OpenShift templates for the API pipeline
* Added github workflow for linting and tests
* added nightly backup scripts (DESENG-68)

### January 26, 2022
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

### November 16, 2021
* Updating version in package.json
* security update Force validator 13.7.0 via resolution (LUP-251)
* adding nodeman for server restart when files change. npm run start-watch (LUP-249)
