pipeline {
  agent any
  options {
    skipDefaultCheckout()
  }
  stages {
    stage('Building: nrts-prc-api master branch') {
      steps {
        script {
          try {
            echo "Building: ${env.JOB_NAME} #${env.BUILD_ID}"
            notifyBuild("Building: ${env.JOB_NAME} #${env.BUILD_ID}", "YELLOW")
            openshiftBuild bldCfg: 'nrts-prc-api-master', showBuildLogs: 'true'
          } catch (e) {
            notifyBuild("BUILD ${env.JOB_NAME} #${env.BUILD_ID} ABORTED", "RED")
            error('Stopping early…')
          }
        }
      }
    }
    stage('Deploy') {
      steps {
        script {
          try {
            echo "Deploying: ${env.JOB_NAME} #${env.BUILD_ID}"
            notifyBuild("Deploying: ${env.JOB_NAME} #${env.BUILD_ID}", "YELLOW")
            openshiftTag destStream: 'nrts-prc-api', verbose: 'true', destTag: 'master', srcStream: 'nrts-prc-api', srcTag: '$BUILD_ID'
          } catch (e) {
            notifyBuild("DEPLOY ${env.JOB_NAME} #${env.BUILD_ID} ABORTED", "RED")
            error('Stopping early…')
          }
        }
        notifyBuild("DEPLOYED: ${env.JOB_NAME} #${env.BUILD_ID}", "GREEN")
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
