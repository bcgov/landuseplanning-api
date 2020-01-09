import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import java.util.regex.Pattern

@NonCPS
String getUrlFromRoute(String routeName, String projectNameSpace = '') {

  def nameSpaceFlag = ''
  if(projectNameSpace?.trim()) {
    nameSpaceFlag = "-n ${projectNameSpace}"
  }

  def url = sh (
    script: "oc get routes ${nameSpaceFlag} -o wide --no-headers | awk \'/${routeName}/{ print match(\$0,/edge/) ?  \"https://\"\$2 : \"http://\"\$2 }\'",
    returnStdout: true
  ).trim()

  return url
}

/*
 * Sends a rocket chat notification
 */
def notifyRocketChat(text, url) {
    def rocketChatURL = url
    def message = text.replaceAll(~/\'/, "")
    def payload = JsonOutput.toJson([
      "username":"Jenkins",
      "icon_url":"https://wiki.jenkins.io/download/attachments/2916393/headshot.png",
      "text": message
    ])

    sh("curl -X POST -H 'Content-Type: application/json' --data \'${payload}\' ${rocketChatURL}")
}


/*
 * takes in a sonarqube status json payload
 * and returns the status string
 */
def sonarGetStatus (jsonPayload) {
  def jsonSlurper = new JsonSlurper()
  return jsonSlurper.parseText(jsonPayload).projectStatus.status
}

/*
 * Updates the global pastBuilds array: it will iterate recursively
 * and add all the builds prior to the current one that had a result
 * different than 'SUCCESS'.
 */
def buildsSinceLastSuccess(previousBuild, build) {
  if ((build != null) && (build.result != 'SUCCESS')) {
    pastBuilds.add(build)
    buildsSinceLastSuccess(pastBuilds, build.getPreviousBuild())
  }
}

/*
 * Generates a string containing all the commit messages from
 * the builds in pastBuilds.
 */
@NonCPS
def getChangeLog(pastBuilds) {
  def log = ""
  for (int x = 0; x < pastBuilds.size(); x++) {
    for (int i = 0; i < pastBuilds[x].changeSets.size(); i++) {
      def entries = pastBuilds[x].changeSets[i].items
      for (int j = 0; j < entries.length; j++) {
        def entry = entries[j]
        log += "* ${entry.msg} by ${entry.author} \n"
      }
    }
  }
  return log;
}

def nodejsTester () {
  openshift.withCluster() {
    openshift.withProject() {
      podTemplate(
        label: 'node-tester',
        name: 'node-tester',
        serviceAccount: 'jenkins',
        cloud: 'openshift',
        slaveConnectTimeout: 300,
        containers: [
          containerTemplate(
            name: 'jnlp',
            image: 'registry.access.redhat.com/openshift3/jenkins-agent-nodejs-8-rhel7',
            resourceRequestCpu: '500m',
            resourceLimitCpu: '1000m',
            resourceRequestMemory: '2Gi',
            resourceLimitMemory: '4Gi',
            workingDir: '/tmp',
            command: '',
          )
        ]
      ) {
        node("node-tester") {
          checkout scm
          sh 'npm i'
          try {
            sh 'npm run tests'
          } finally {
            echo "Unit Tests Passed"
          }
        }
      }
      return true
    }
  }
}

// todo templates can be pulled from a repository, instead of declared here
def nodejsSonarqube () {
  openshift.withCluster() {
    openshift.withProject() {
      podTemplate(
        label: 'node-sonarqube',
        name: 'node-sonarqube',
        serviceAccount: 'jenkins',
        cloud: 'openshift',
        slaveConnectTimeout: 300,
        containers: [
          containerTemplate(
            name: 'jnlp',
            image: 'registry.access.redhat.com/openshift3/jenkins-agent-nodejs-8-rhel7',
            resourceRequestCpu: '500m',
            resourceLimitCpu: '1000m',
            resourceRequestMemory: '2Gi',
            resourceLimitMemory: '4Gi',
            workingDir: '/tmp',
            command: '',
            args: '${computer.jnlpmac} ${computer.name}',
          )
        ]
      ) {
        node("node-sonarqube") {
          checkout scm
          dir('sonar-runner') {
            try {

              // get sonarqube url
              def SONARQUBE_URL = getUrlFromRoute('sonarqube').trim()
              echo "${SONARQUBE_URL}"

              // sonarqube report link
              def SONARQUBE_STATUS_URL = "${SONARQUBE_URL}/api/qualitygates/project_status?projectKey=lup-api"

              // The name of your SonarQube project
              def SONAR_PROJECT_NAME = 'lup-api'

              // The project key of your SonarQube project
              def SONAR_PROJECT_KEY = 'lup-api'

              // The base directory of your project.
              // This is relative to the location of the `sonar-runner` directory within your project.
              // More accurately this is relative to the Gradle build script(s) that manage the SonarQube Scanning
              def SONAR_PROJECT_BASE_DIR = '../'

              // The source code directory you want to scan.
              // This is relative to the project base directory.
              def SONAR_SOURCES = './api'

              boolean firstScan = false;

              def OLD_SONAR_DATE

              try {
                // get old sonar report date
                def OLD_SONAR_DATE_JSON = sh(returnStdout: true, script: "curl -w '%{http_code}' '${SONARQUBE_STATUS_URL}'")
                OLD_SONAR_DATE = sonarGetDate (OLD_SONAR_DATE_JSON)
              } catch (error) {
                firstScan = true
              }

              // run scan
              //sh("oc extract secret/sonarqube-secrets --to=${env.WORKSPACE}/sonar-runner --confirm")
              //SONARQUBE_URL = sh(returnStdout: true, script: 'cat sonarqube-route-url')

              sh "npm install typescript@3.2.1"
              sh returnStdout: true, script: "./gradlew sonarqube --stacktrace --info --debug \
                -Dsonar.host.url=${SONARQUBE_URL} \
                -Dsonar. \
                -Dsonar.verbose=true \
                -Dsonar.projectName='${SONAR_PROJECT_NAME}' \
                -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                -Dsonar.projectBaseDir=${SONAR_PROJECT_BASE_DIR} \
                -Dsonar.sources=${SONAR_SOURCES}"

              if ( !firstScan ) {
                // wiat for report to be updated
                if ( !sonarqubeReportComplete ( OLD_SONAR_DATE, SONARQUBE_STATUS_URL ) ) {
                  echo "sonarqube report failed to complete, or timed out"

                  notifyRocketChat(
                    "@all The latest build, ${env.BUILD_DISPLAY_NAME} of landuseplanning-admin seems to be broken. \n ${env.BUILD_URL}\n Error: \n sonarqube report failed to complete, or timed out : ${SONARQUBE_URL}",
                    ROCKET_DEPLOY_WEBHOOK
                  )

                  currentBuild.result = "FAILURE"
                  exit 1
                }
              } else {
                sleep (30)
              }

              // check if sonarqube passed
              //sh("oc extract secret/sonarqube-status-urls --to=${env.WORKSPACE}/sonar-runner --confirm")
              //SONARQUBE_STATUS_URL = sh(returnStdout: true, script: 'cat sonarqube-status-api')

              SONARQUBE_STATUS_JSON = sh(returnStdout: true, script: "curl -w '%{http_code}' '${SONARQUBE_STATUS_URL}'")
              SONARQUBE_STATUS = sonarGetStatus (SONARQUBE_STATUS_JSON)

              if ( "${SONARQUBE_STATUS}" == "ERROR") {
                echo "Scan Failed"

                notifyRocketChat(
                  "@all The latest build ${env.BUILD_DISPLAY_NAME} of lup-api seems to be broken. \n ${env.BUILD_URL}\n Error: \n Sonarqube scan failed",
                  ROCKET_DEPLOY_WEBHOOK
                )

                currentBuild.result = 'FAILURE'
                exit 1
              } else {
                echo "Scan Passed"
              }

            } catch (error) {
              notifyRocketChat(
                "@all The latest build ${env.BUILD_DISPLAY_NAME} of lup-api seems to be broken. \n ${env.BUILD_URL}\n Error: \n ${error}",
                ROCKET_DEPLOY_WEBHOOK
              )
              throw error
            } finally {
              echo "Scan Complete"
            }
          }
        }
      }
      return true
    }
  }
}

def CHANGELOG = "No new changes"
def IMAGE_HASH = "latest"

pipeline {
  agent any
  options {
    disableResume()
  }
  stages {
    stage('Parallel Build Steps') {
      failFast true
      parallel {
        stage('Build') {
          agent any
          steps {
            script {
              pastBuilds = []
              buildsSinceLastSuccess(pastBuilds, currentBuild);
              CHANGELOG = getChangeLog(pastBuilds);

              echo ">>>>>>Changelog: \n ${CHANGELOG}"

              try {
                sh("oc extract secret/rocket-chat-secrets --to=${env.WORKSPACE} --confirm")
                ROCKET_DEPLOY_WEBHOOK = sh(returnStdout: true, script: 'cat rocket-deploy-webhook')

                echo "Building lup-api develop branch"
                openshiftBuild bldCfg: 'lup-api', showBuildLogs: 'true'
                echo "Build done"

                echo ">>> Get Image Hash"
                // Don't tag with BUILD_ID so the pruner can do it's job; it won't delete tagged images.
                // Tag the images for deployment based on the image's hash
                IMAGE_HASH = sh (
                  script: """oc get istag lup-api:latest -o template --template=\"{{.image.dockerImageReference}}\"|awk -F \":\" \'{print \$3}\'""",
                  returnStdout: true).trim()
                echo ">> IMAGE_HASH: ${IMAGE_HASH}"
              } catch (error) {
                notifyRocketChat(
                  "@all The build ${env.BUILD_DISPLAY_NAME} of lup-api, seems to be broken.\n ${env.BUILD_URL}\n Error: \n ${error.message}",
                  ROCKET_DEPLOY_WEBHOOK
                )
                throw error
              }
            }
          }
        }
/*
        stage('Unit Tests') {
          steps {
            script {
              echo "Running Unit Tests"
              def result = nodejsTester()
            }
          }
        }

        stage('Sonarqube') {
          steps {
            script {
              echo "Running Sonarqube"
              def result = nodejsSonarqube()
            }
          }
        }*/
      }
    }

    stage('Deploy to dev'){
      steps {
        script {
          try {
            echo "Deploying to dev..."
            openshiftTag destStream: 'lup-api', verbose: 'false', destTag: 'dev', srcStream: 'lup-api', srcTag: "${IMAGE_HASH}"
            sleep 5
            // todo lup-test? what depCfg?
            openshiftVerifyDeployment depCfg: 'gcpe-lup-api-dev', namespace: 'xti26n-dev', replicaCount: 1, verbose: 'false', verifyReplicaCount: 'false', waitTime: 600000
            echo ">>>> Deployment Complete"

            notifyRocketChat(
              "A new version of lup-api is now in Dev, build: ${env.BUILD_DISPLAY_NAME} \n Changes: \n ${CHANGELOG}",
              ROCKET_DEPLOY_WEBHOOK
            )

          } catch (error) {
            notifyRocketChat(
              "@all The build ${env.BUILD_DISPLAY_NAME} of lup-api, seems to be broken.\n ${env.BUILD_URL}\n Error: \n ${error.message}",
              ROCKET_DEPLOY_WEBHOOK
            )
            currentBuild.result = "FAILURE"
            throw new Exception("Deploy failed")
          }
        }
      }
    }
  }
}