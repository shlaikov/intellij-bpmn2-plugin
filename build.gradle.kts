import org.jetbrains.changelog.Changelog
import org.jetbrains.changelog.markdownToHTML
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import com.github.gradle.node.yarn.task.YarnTask

fun properties(key: String) = providers.gradleProperty(key)
fun environment(key: String) = providers.environmentVariable(key)

plugins {
  id("java")
  id("com.github.node-gradle.node") version "5.0.0"
  alias(libs.plugins.kotlin)
  alias(libs.plugins.gradleIntelliJPlugin)
  alias(libs.plugins.changelog)
  alias(libs.plugins.qodana)
  alias(libs.plugins.kover)
}

group = properties("pluginGroup").get()
version = properties("pluginVersion").get()

repositories {
  mavenCentral()
  intellijPlatform {
    defaultRepositories()
  }
}

dependencies {
  intellijPlatform {
    create(properties("platformType"), properties("platformVersion"), useInstaller = false)
    pluginVerifier()
    zipSigner()
  }
}

kotlin {
  jvmToolchain(17)
}

node {
  version.set("20.18.0")
  distBaseUrl.set("https://nodejs.org/dist")
  download.set(true)
  yarnWorkDir.set(file("${project.projectDir}/.cache/yarn"))
  nodeProjectDir.set(file("${project.projectDir}/src/main/resources/webview"))
}

intellijPlatform {
  pluginConfiguration {
    version = properties("pluginVersion")

    description = providers.fileContents(layout.projectDirectory.file("README.md")).asText.map {
      val start = "<!-- Plugin description -->"
      val end = "<!-- Plugin description end -->"

      with(it.lines()) {
        if (!containsAll(listOf(start, end))) {
          throw GradleException("Plugin description section not found in README.md:\n$start ... $end")
        }
        subList(indexOf(start) + 1, indexOf(end)).joinToString("\n").let(::markdownToHTML)
      }
    }

    val changelog = project.changelog
    changeNotes = properties("pluginVersion").map { pluginVersion ->
      with(changelog) {
        renderItem(
          (getOrNull(pluginVersion) ?: getUnreleased())
            .withHeader(false)
            .withEmptySections(false),
          Changelog.OutputType.HTML,
        )
      }
    }

    ideaVersion {
      sinceBuild = properties("pluginSinceBuild")
      untilBuild = provider { null }
    }
  }

  signing {
    certificateChain = environment("CERTIFICATE_CHAIN")
    privateKey = environment("PRIVATE_KEY")
    password = environment("PRIVATE_KEY_PASSWORD")
  }

  publishing {
    token = environment("PUBLISH_TOKEN")
    channels = properties("pluginVersion").map {
      listOf(it.split('-').getOrElse(1) { "default" }.split('.').first())
    }
  }

  pluginVerification {
    ides {
      ide(IntelliJPlatformType.IntellijIdeaCommunity, "2024.1")
      ide(IntelliJPlatformType.IntellijIdeaCommunity, "2024.2")
      ide(IntelliJPlatformType.IntellijIdeaCommunity, "2024.3")
    }
  }

  buildSearchableOptions = false
}

changelog {
  groups.empty()
  repositoryUrl = properties("pluginRepositoryUrl")
}

kover {
  reports {
    total {
      xml {
        onCheck = true
      }
    }
  }
}

tasks.register<YarnTask>("buildYarn") {
  dependsOn(tasks.yarn)
  yarnCommand.set(listOf("run", "build"))
  args.set(listOf(
    "--out-dir", "${project.projectDir}/src/main/resources/webview/dist"
  ))
  inputs.dir("src/")
}

tasks.register<Delete>("cleanYarnModules") {
  delete("${project.projectDir}/src/main/resources/webview/node_modules")
}

tasks {
  compileTestKotlin {
    enabled = false
  }

  test {
    enabled = false
  }

  wrapper {
    gradleVersion = properties("gradleVersion").get()
  }

  yarn {
    nodeModulesOutputFilter {
      exclude("notExistingFile")
    }
  }

  publishPlugin {
    dependsOn(patchChangelog)
  }
}
