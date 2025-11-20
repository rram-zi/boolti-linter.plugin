export const BANNED_WORDS_RULE = {
    "티켓팅": { suggestion: "예매", category: "단어 수정" },
    "구매": { suggestion: "예매", category: "단어 수정" },
    "구입": { suggestion: "예매", category: "단어 수정" },
    "고객": { suggestion: "유저", category: "단어 수정" },
    "사용자": { suggestion: "유저", category: "단어 수정" },
    "판매자": { suggestion: "주최자", category: "단어 수정" },
    "셀러": { suggestion: "주최자", category: "단어 수정" },
    "호스트": { suggestion: "주최자", category: "단어 수정" },
} as const;
export type BannedWordsRuleKey = keyof typeof BANNED_WORDS_RULE;

export const IRREGULAR_VERBS_RULE = {
    "않습니다": "않아요",
    "좋습니다": "좋아요",
    "없습니다": "없어요",
    "입니다": "이에요",
    "합니다": "해요",
    "됩니다": "돼요",
    "습니까?": "까요?",
} as const;
export const STANDALONE_WORD_EXCEPTIONS = ['나가기', '확인', '안내', '정보', '취소', '닫기', '삭제', '출연진', '공연 정보'];
export const BUTTON_TEXT_EXCEPTIONS = ['하러가기', '보기', '찾기', '접기', '공유하기', '이전으로', '다음으로', '가기', '바로가기', '문의하기'];
export const BUTTON_TEXT_RULE = { endsWith: '하기' };