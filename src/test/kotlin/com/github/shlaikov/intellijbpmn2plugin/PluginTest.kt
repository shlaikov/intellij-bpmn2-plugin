package com.github.shlaikov.intellijbpmn2plugin

import com.github.shlaikov.intellijbpmn2plugin.editor.EditorProvider
import com.intellij.ide.highlighter.XmlFileType
import com.intellij.openapi.components.service
import com.intellij.openapi.command.impl.DummyProject
import com.intellij.mock.MockVirtualFileSystem
import com.intellij.psi.xml.XmlFile
import com.intellij.testFramework.TestDataPath
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.intellij.util.PsiErrorElementUtil
import com.github.shlaikov.intellijbpmn2plugin.services.ProjectService

@TestDataPath("\$CONTENT_ROOT/src/test/testData")
class PluginTest : BasePlatformTestCase() {

    fun testXMLFile() {
        val psiFile = myFixture.configureByText(XmlFileType.INSTANCE, "<foo>bar</foo>")
        val xmlFile = assertInstanceOf(psiFile, XmlFile::class.java)

        assertFalse(PsiErrorElementUtil.hasErrors(project, xmlFile.virtualFile))

        assertNotNull(xmlFile.rootTag)

        xmlFile.rootTag?.let {
            assertEquals("foo", it.name)
            assertEquals("bar", it.value.text)
        }
    }

    fun testRename() {
        myFixture.testRename("foo.xml", "foo_after.xml", "a2")
    }

    fun testProjectService() {
        val projectService = project.service<ProjectService>()

        assertNotNull(projectService)
    }

    override fun getTestDataPath() = "src/test/testData/rename"

    @Suppress("INACCESSIBLE_TYPE")
    fun `test accept() method`() {
        val editorProvider = EditorProvider()
        val project = DummyProject.getInstance()
        val vFS = MockVirtualFileSystem()

        val testCases = mapOf(
            "test.svg" to false,
            "test.bpmn2" to true,
            "test.bpmn" to true,
            "test.xml" to false,
            "test.kt" to false,
            "test.bpmn.xml" to true,
            "test.html" to false,
            "test.bpm" to false,
            "test.bpmn.svg.xml" to false
        )

        testCases.forEach { (filename, expectedResult) ->
            vFS.file(filename,"")
            val file = vFS.findFileByPath(filename)

            assert(expectedResult == editorProvider.accept(project, file))
        }
    }
}
