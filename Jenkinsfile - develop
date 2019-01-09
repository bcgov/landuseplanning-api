def sonarqubePodLabel = "prc-api-${UUID.randomUUID().toString()}"
podTemplate(label: sonarqubePodLabel, name: sonarqubePodLabel, serviceAccount: 'jenkins', cloud: 'openshift', containers: [
  containerTemplate(
    name: 'jnlp',
    image: '172.50.0.2:5000/openshift/jenkins-slave-python3nodejs',
    resourceRequestCpu: '500m',
    resourceLimitCpu: '1000m',
    resourceRequestMemory: '1Gi',
    resourceLimitMemory: '4Gi',
    workingDir: '/tmp',
    command: '',
    args: '${computer.jnlpmac} ${computer.name}',
    envVars: [
      envVar(key: 'SONARQUBE_URL', value: 'https://sonarqube-prc-tools.pathfinder.gov.bc.ca')
    ]
  )
]) {
  node(sonarqubePodLabel) {
    stage('checkout code') {
      checkout scm
    }
    stage('exeucte sonar') {
      dir('sonar-runner') {
        try {
          sh './gradlew sonarqube -Dsonar.host.url=https://sonarqube-prc-tools.pathfinder.gov.bc.ca -Dsonar.verbose=true --stacktrace --info'
        } finally {

        }
      }
    }
  }
}

pipeline {
  agent any
  options {
    skipDefaultCheckout()
  }
  stages {
    stage('Building: nrts-prc-api develop branch') {
      steps {
        script {
          try {
            echo "Building: ${env.JOB_NAME} #${env.BUILD_ID}"
            notifyBuild("Building: ${env.JOB_NAME} #${env.BUILD_ID}", "YELLOW")
            openshiftBuild bldCfg: 'nrts-prc-api', showBuildLogs: 'true'
          } catch (e) {
            notifyBuild("BUILD ${env.JOB_NAME} #${env.BUILD_ID} ABORTED", "RED")
            error('Stopping early…')
          }
        }
      }
    }
  }
}

def notifyBuild(String msg = '', String colour = 'GREEN') {
  if (colour == 'YELLOW') {
    colorCode = '#FFFF00'
  } else if (colour == 'GREEN') {
    colorCode = '#00FF00'
  } else {
    colorCode = '#FF0000'
  }

  // Send notifications
  slackSend (color: colorCode, message: msg)
}
