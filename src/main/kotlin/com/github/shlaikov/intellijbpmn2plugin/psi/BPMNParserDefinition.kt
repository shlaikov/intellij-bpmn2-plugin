package com.github.shlaikov.intellijbpmn2plugin.psi

import com.github.shlaikov.intellijbpmn2plugin.BPMNFile
import com.intellij.lang.*
import com.intellij.lang.xml.XMLLanguage
import com.intellij.lexer.Lexer
import com.intellij.lexer.XmlLexer
import com.intellij.openapi.project.Project
import com.intellij.psi.FileViewProvider
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IFileElementType
import com.intellij.psi.tree.TokenSet


class BPMNParserDefinition: ParserDefinition {
    override fun createLexer(project: Project?): Lexer {
        return XmlLexer()
    }

    override fun createParser(project: Project?): PsiParser {
        return LanguageParserDefinitions.INSTANCE.forLanguage(Language.findInstance(XMLLanguage::class.java)).createParser(project)
    }

    override fun getFileNodeType(): IFileElementType {
        return BPMNFile.BPMN_FILE_ELEMENT_TYPE
    }

    override fun getCommentTokens(): TokenSet {
        return LanguageParserDefinitions.INSTANCE.forLanguage(Language.findInstance(XMLLanguage::class.java)).commentTokens
    }

    override fun getWhitespaceTokens(): TokenSet {
        return LanguageParserDefinitions.INSTANCE.forLanguage(Language.findInstance(XMLLanguage::class.java)).whitespaceTokens
    }

    override fun getStringLiteralElements(): TokenSet {
        return TokenSet.EMPTY
    }

    override fun createElement(node: ASTNode?): PsiElement {
        throw IllegalArgumentException("Unknown element: $node")
    }

    override fun createFile(viewProvider: FileViewProvider): PsiFile {
        return BPMNFile(viewProvider)
    }
}
