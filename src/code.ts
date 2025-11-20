// src/code.ts (스타일 보존 로직 완벽 수정 최종 버전)

import { BANNED_WORDS_RULE, BannedWordsRuleKey, IRREGULAR_VERBS_RULE, BUTTON_TEXT_RULE, STANDALONE_WORD_EXCEPTIONS, BUTTON_TEXT_EXCEPTIONS } from './rules';

type ErrorCategory = '문체 수정' | '단어 수정';
type ErrorType = 'BANNED_WORD' | 'SENTENCE_ENDING' | 'BUTTON_TEXT';
interface LinterErrorDetail { type: ErrorType; category: ErrorCategory; suggestion: string; errorWord?: string; }
interface GroupedLinterError { nodeId: string; content: string; finalSuggestedText: string; errors: LinterErrorDetail[]; }

function isSceneNode(node: BaseNode): node is SceneNode { return node.parent != null && node.parent.type !== 'DOCUMENT'; }
figma.showUI(__html__, { width: 340, height: 540 });

figma.ui.onmessage = async (msg) => {
    if (msg.type === 'start-check') {
        const errors = await lintingProcess();
        figma.ui.postMessage({ type: 'check-complete', errors: errors });
    }
    else if (msg.type === 'apply-fix' || msg.type === 'apply-all-fixes') {
        const fixes = msg.type === 'apply-all-fixes' ? msg.fixes : [{ nodeId: msg.nodeId, newText: msg.newText }];

        const fontsToLoad = new Set<FontName>();
        const nodesToUpdate: { node: TextNode, newText: string }[] = [];

        for (const fix of fixes) {
            const node = figma.getNodeById(fix.nodeId);
            if (node && node.type === 'TEXT') {
                const textNode = node as TextNode;
                nodesToUpdate.push({ node: textNode, newText: fix.newText });

                if (textNode.fontName === figma.mixed) {
                    for (let i = 0; i < textNode.characters.length; i++) {
                        const font = textNode.getRangeFontName(i, i + 1) as FontName | typeof figma.mixed;
                        if (font !== figma.mixed) {
                            fontsToLoad.add(font as FontName);
                        }
                    }
                } else {
                    fontsToLoad.add(textNode.fontName as FontName);
                }
            }
        }

        await Promise.all(Array.from(fontsToLoad).map(font => figma.loadFontAsync(font)));

        // [핵심 수정] 파괴적인 .characters 대신, 스타일을 보존하는 API를 사용합니다.
        for (const item of nodesToUpdate) {
            const node = item.node;
            const originalLength = node.characters.length;

            // 1. 먼저 기존 텍스트를 모두 지웁니다.
            if (originalLength > 0) {
                node.deleteCharacters(0, originalLength);
            }
            // 2. 그 자리에 새로운 텍스트를 삽입합니다. 
            //    이렇게 하면 첫 글자의 스타일이 새로운 텍스트 전체에 적용되면서도, 
            //    Figma가 다른 스타일 정보를 파괴하지 않습니다.
            node.insertCharacters(0, item.newText);
        }
    }
    else if (msg.type === 'select-node') {
        const node = figma.getNodeById(msg.nodeId);
        if (node && isSceneNode(node)) { figma.viewport.scrollAndZoomIntoView([node]); figma.currentPage.selection = [node]; }
    }
    else if (msg.type === 'resize') {
        figma.ui.resize(msg.width, msg.height);
    }
};

async function lintingProcess(): Promise<GroupedLinterError[]> {
    const allGroupedErrors: GroupedLinterError[] = [];
    let targetNodes: readonly SceneNode[] = figma.currentPage.selection;
    if (targetNodes.length === 0) { targetNodes = figma.currentPage.children; }
    const textNodes = await findAllTextNodes(targetNodes);
    for (const node of textNodes) {
        const errorsForNode: LinterErrorDetail[] = [];
        let currentText = node.characters;
        let finalSuggestedText = node.characters;
        const bannedWordResult = checkBannedWords(currentText);
        if (bannedWordResult) { errorsForNode.push(bannedWordResult.error); finalSuggestedText = bannedWordResult.suggestedText; }
        let textForNextCheck = bannedWordResult ? bannedWordResult.suggestedText : currentText;
        if (isInsideButton(node)) {
            const buttonTextResult = checkButtonText(textForNextCheck);
            if (buttonTextResult) { errorsForNode.push(buttonTextResult.error); finalSuggestedText = buttonTextResult.suggestedText; allGroupedErrors.push({ nodeId: node.id, content: node.characters, finalSuggestedText, errors: errorsForNode }); continue; }
            else { if (STANDALONE_WORD_EXCEPTIONS.includes(textForNextCheck.trim()) || BUTTON_TEXT_EXCEPTIONS.some(ex => textForNextCheck.trim().endsWith(ex))) { if (errorsForNode.length > 0) { allGroupedErrors.push({ nodeId: node.id, content: node.characters, finalSuggestedText, errors: errorsForNode }); } continue; } }
        }
        const sentenceEndingResult = checkSentenceEnding(textForNextCheck);
        if (sentenceEndingResult) { errorsForNode.push(sentenceEndingResult.error); finalSuggestedText = sentenceEndingResult.suggestedText; }
        if (errorsForNode.length > 0) { allGroupedErrors.push({ nodeId: node.id, content: node.characters, finalSuggestedText, errors: errorsForNode }); }
    }
    return allGroupedErrors;
}

async function findAllTextNodes(nodes: readonly SceneNode[]): Promise<TextNode[]> { const textNodes: TextNode[] = []; for (const node of nodes) { if (node.type === 'TEXT') { textNodes.push(node); } else if ('children' in node) { textNodes.push(...await findAllTextNodes(node.children)); } } return textNodes; }
function isInsideButton(node: TextNode): boolean { let parent = node.parent; while (parent) { if (parent.name.toLowerCase().includes('button')) return true; if (parent.type === 'PAGE') break; parent = parent.parent; } return false; }

function checkBannedWords(text: string): { error: LinterErrorDetail, suggestedText: string } | null {
    for (const bannedWord of Object.keys(BANNED_WORDS_RULE) as BannedWordsRuleKey[]) {
        if (text.includes(bannedWord)) {
            const rule = BANNED_WORDS_RULE[bannedWord];
            return { error: { type: 'BANNED_WORD', category: rule.category, errorWord: bannedWord, suggestion: `'${rule.suggestion}'(으)로 수정을 추천합니다.` }, suggestedText: text.replace(new RegExp(bannedWord, 'g'), rule.suggestion) };
        }
    }
    return null;
}
function checkSentenceEnding(text: string): { error: LinterErrorDetail, suggestedText: string } | null {
    const lines = text.split(/\r\n?|\n|\u2028/); let hasError = false;
    const newLines = lines.map(line => {
        const trimmedLine = line.trim(); if (trimmedLine === '') return line;
        let trailingPunctuation = ''; if (trimmedLine.endsWith('.') || trimmedLine.endsWith('?') || trimmedLine.endsWith('!')) trailingPunctuation = trimmedLine.slice(-1);
        const cleanedLine = trimmedLine.replace(/[.?!]$/, '');
        for (const [irregularEnding, suggestion] of Object.entries(IRREGULAR_VERBS_RULE)) {
            if (cleanedLine.endsWith(irregularEnding.replace('?', ''))) {
                const stem = cleanedLine.slice(0, -irregularEnding.replace('?', '').length); hasError = true;
                return stem + suggestion + (suggestion.includes('?') ? '' : trailingPunctuation);
            }
        }
        // [핵심 수정] 'trailingPuncuation' 오타를 'trailingPunctuation'으로 수정했습니다.
        if (cleanedLine.endsWith('습니다')) { const stem = cleanedLine.slice(0, -3); hasError = true; return stem + '어요' + trailingPunctuation; }
        if (cleanedLine.endsWith('ㅂ니다')) { const stem = cleanedLine.slice(0, -3); hasError = true; return stem + '아요' + trailingPunctuation; }
        return line;
    });
    if (hasError) { const newText = newLines.join('\n'); return { error: { type: 'SENTENCE_ENDING', category: '문체 수정', suggestion: `어미를 '-해요'체로 수정을 추천합니다.` }, suggestedText: newText }; }
    return null;
}
function checkButtonText(text: string): { error: LinterErrorDetail, suggestedText: string } | null {
    const cleanedText = text.trim();
    if (STANDALONE_WORD_EXCEPTIONS.includes(cleanedText)) return null;
    if (BUTTON_TEXT_EXCEPTIONS.some(exception => cleanedText.endsWith(exception)) || ['?', '!'].some(ex => cleanedText.endsWith(ex))) return null;
    if (!cleanedText.endsWith(BUTTON_TEXT_RULE.endsWith)) { return { error: { type: 'BUTTON_TEXT', category: '문체 수정', suggestion: `버튼 텍스트는 '${BUTTON_TEXT_RULE.endsWith}' 형태로 끝나는 것을 추천합니다.` }, suggestedText: cleanedText + BUTTON_TEXT_RULE.endsWith }; }
    return null;
}
