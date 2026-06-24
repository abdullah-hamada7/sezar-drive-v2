allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

subprojects {
    val proj = this
    if (proj.state.executed) {
        if (proj.plugins.hasPlugin("com.android.library") || proj.plugins.hasPlugin("com.android.application")) {
            val android = proj.extensions.findByName("android") as? com.android.build.gradle.BaseExtension
            android?.compileSdkVersion(36)
            android?.defaultConfig?.targetSdkVersion(36)
        }
    } else {
        proj.afterEvaluate {
            if (proj.plugins.hasPlugin("com.android.library") || proj.plugins.hasPlugin("com.android.application")) {
                val android = proj.extensions.findByName("android") as? com.android.build.gradle.BaseExtension
                android?.compileSdkVersion(36)
                android?.defaultConfig?.targetSdkVersion(36)
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
