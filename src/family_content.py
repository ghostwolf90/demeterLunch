from __future__ import annotations

import hashlib
from typing import Any


FOOD_EDUCATION_SOURCE = {
    "label": "食育設計參考：日本文部科學省",
    "url": "https://www.mext.go.jp/a_menu/01_k.htm",
}


def _health_tip_source(news_id: int) -> dict[str, str]:
    return {
        "label": "健康小常識：校園食材登錄平臺",
        "url": (
            "https://fatraceschool.k12ea.gov.tw/frontend/"
            f"news-detail.html?newsId={news_id}"
        ),
    }


NUTRITIONIST_GUIDE_SOURCE = {
    "label": "午餐指引：教育部國教署",
    "url": (
        "https://schoollunchdemo.k12ea.gov.tw/announcement"
        "?announcementMainTypeId=1"
    ),
}


FOOD_CARDS = (
    {
        "keywords": ("蚵白菜", "青梗白菜", "小白菜", "青江菜", "油菜"),
        "ingredient": "不結球白菜",
        "title": "葉子不會包成一顆球",
        "fact": "蚵仔白菜、青梗白菜和油菜都屬常見的不結球白菜；它們的葉柄、葉形和深淺各不相同。",
        "prompt": "今天這株菜的葉柄是白色、綠色，還是淺綠色？",
        "source": _health_tip_source(6200),
        "featured_dates": ("2026-10-05",),
    },
    {
        "keywords": ("小松菜", "空心菜", "菠菜", "萵苣", "味美菜"),
        "ingredient": "葉菜",
        "title": "葉子和菜梗，口感不一樣",
        "fact": "同一株葉菜裡，葉片通常較柔軟，菜梗則保留更多脆度。慢慢咀嚼，就能發現兩種口感。",
        "prompt": "今天吃到的青菜，是葉子比較好吃，還是菜梗比較好吃？",
    },
    {
        "keywords": ("大白菜", "高麗", "酸菜"),
        "ingredient": "白菜與高麗菜",
        "title": "一層一層包起來的蔬菜",
        "fact": "白菜和高麗菜的葉片會層層包覆；切絲、燉煮或快炒，會呈現完全不同的口感。",
        "prompt": "今天的菜是脆脆的，還是吸滿湯汁、軟軟的？",
    },
    {
        "keywords": ("青花菜", "花椰菜"),
        "ingredient": "青花菜與花椰菜",
        "title": "都是花，吃的部位不一樣",
        "fact": "青花菜吃的是一顆顆花蕾，花椰菜吃的則是尚未分化的花原體；兩者不是只有顏色不同。",
        "prompt": "今天的菜，看得到一顆顆小花蕾嗎？",
        "source": _health_tip_source(6018),
    },
    {
        "keywords": ("蒲瓜", "絲瓜", "冬瓜"),
        "ingredient": "瓜類",
        "title": "看似清淡，也有自己的甜味",
        "fact": "瓜類加熱後會釋出水分，味道溫和，很適合和菇類、蛋或海鮮一起煮。",
        "prompt": "你能分辨今天的瓜是清脆，還是柔軟多汁嗎？",
    },
    {
        "keywords": ("竹筍", "鮮筍", "筍香"),
        "ingredient": "竹筍",
        "title": "竹子剛長出的嫩芽",
        "fact": "竹筍是竹子的嫩芽，不同季節與品種，甜味、纖維和脆度也會不同。",
        "prompt": "今天的竹筍咬起來，有沒有清脆的聲音？",
    },
    {
        "keywords": ("菇", "金菇"),
        "ingredient": "菇類",
        "title": "菇不是蔬菜，而是真菌",
        "fact": "香菇、金針菇和杏鮑菇都屬於真菌；不同菇類有不同形狀、香氣和咬感。",
        "prompt": "如果只看形狀，你認得今天吃到的是哪一種菇嗎？",
    },
    {
        "keywords": ("豆腐", "豆皮", "豆干", "豆乳", "豆漿"),
        "ingredient": "豆製品",
        "title": "黃豆可以變成好多模樣",
        "fact": "黃豆經過浸泡、磨製與凝固，可以做成豆漿、豆腐、豆干和豆皮，口感各不相同。",
        "prompt": "今天的豆製品是嫩、彈、滑，還是有嚼勁？",
    },
    {
        "keywords": ("蒸蛋", "炒蛋", "滷蛋", "蛋花", "親子丼", "起司蛋"),
        "ingredient": "雞蛋",
        "title": "加熱，讓蛋產生變化",
        "fact": "透明的蛋白遇熱後會變白並凝固；蒸、炒、煮的溫度與時間，也會改變它的口感。",
        "prompt": "今天的蛋是滑嫩、鬆軟，還是扎實？",
    },
    {
        "keywords": ("蘋果",),
        "ingredient": "蘋果",
        "title": "切開後，顏色會慢慢改變",
        "fact": "蘋果切開接觸空氣後，果肉會逐漸變褐色；這是食物與氧氣發生變化的結果。",
        "prompt": "你喜歡清脆的蘋果，還是比較鬆軟、多汁的蘋果？",
    },
    {
        "keywords": ("香蕉",),
        "ingredient": "香蕉",
        "title": "外皮上的斑點，是成熟的線索",
        "fact": "香蕉成熟時，外皮會由綠轉黃，之後可能出現褐色斑點，香氣與甜味也會跟著改變。",
        "prompt": "你喜歡剛轉黃的香蕉，還是有一點斑點、比較香甜的香蕉？",
    },
    {
        "keywords": ("鳳梨釋迦",),
        "ingredient": "鳳梨釋迦",
        "title": "名字裡有鳳梨，卻不是鳳梨",
        "fact": "鳳梨釋迦是兩種番荔枝雜交出的水果，因為酸甜風味像熱帶鳳梨而得名。",
        "prompt": "它的味道比較像鳳梨，還是一般釋迦？",
        "source": _health_tip_source(5996),
    },
    {
        "keywords": ("火龍果",),
        "ingredient": "火龍果",
        "title": "果肉裡藏著許多小種子",
        "fact": "火龍果的黑色小點就是種子；白肉與紅肉品種的外觀不同，口感都相當細緻。",
        "prompt": "不用數完，猜猜一片火龍果裡大約有多少顆種子？",
    },
    {
        "keywords": ("奇異果",),
        "ingredient": "奇異果",
        "title": "粗粗的外皮，柔軟的果肉",
        "fact": "奇異果外皮帶有細毛，切開後可以看見種子從中心向外排列，像一個小小的放射圖案。",
        "prompt": "切面看起來最像太陽、花朵，還是一個輪子？",
    },
    {
        "keywords": ("藍莓",),
        "ingredient": "藍莓",
        "title": "小小一顆，也能仔細觀察",
        "fact": "藍莓表面常有一層天然果粉，看起來霧霧的；果實成熟程度不同，酸甜也會有差異。",
        "prompt": "六顆藍莓裡，每一顆的大小和味道都一樣嗎？",
    },
    {
        "keywords": ("糙米", "五穀", "燕麥", "紅藜", "胚芽"),
        "ingredient": "全穀雜糧",
        "title": "白飯以外，米飯還能有很多顏色",
        "fact": "糙米、燕麥、紅藜和其他穀物混進米飯後，會增加顏色、香氣與咀嚼感。",
        "prompt": "今天的飯裡，你找到了幾種不同顏色或形狀的穀物？",
        "source": _health_tip_source(6185),
    },
    {
        "keywords": ("地瓜葉",),
        "ingredient": "地瓜葉",
        "title": "吃葉子的地瓜，品種不太一樣",
        "fact": "食用地瓜葉會挑嫩葉採收，口感較軟；拿來種地瓜的藤葉通常較成熟，纖維也較粗。",
        "prompt": "今天的地瓜葉，是嫩嫩的，還是保留一點纖維感？",
        "source": _health_tip_source(6184),
    },
    {
        "keywords": ("地瓜",),
        "ingredient": "地瓜",
        "title": "地瓜發芽，不等於有毒",
        "fact": "地瓜發芽不會產生有毒物質，但澱粉會減少，口感和營養也可能跟著下降。",
        "prompt": "你喜歡鬆軟的地瓜，還是比較扎實的口感？",
        "source": _health_tip_source(6181),
    },
    {
        "keywords": ("馬鈴薯",),
        "ingredient": "馬鈴薯",
        "title": "吃的是長在地下的塊莖",
        "fact": "馬鈴薯的食用部位是地下塊莖，表面的凹點就是芽眼；臺灣多在較冷涼的秋冬栽培。",
        "prompt": "今天的馬鈴薯是切塊、切絲，還是壓成泥？",
        "source": _health_tip_source(6164),
    },
    {
        "keywords": ("芋頭",),
        "ingredient": "芋頭",
        "title": "藏在土裡的綿密食材",
        "fact": "芋頭加熱後會從扎實變得鬆軟綿密，切塊、壓泥或煮湯會呈現不同口感。",
        "prompt": "今天的芋頭還看得到形狀，還是已經融進料理裡？",
    },
    {
        "keywords": ("玉米",),
        "ingredient": "玉米",
        "title": "玉米粒為什麼排得這麼整齊？",
        "fact": "每一顆玉米粒都是一粒種子，沿著玉米穗排列成一整圈又一整圈。",
        "prompt": "下次看到整根玉米，可以觀察每一排是不是完全筆直。",
    },
    {
        "keywords": ("紅蔥頭", "油蔥"),
        "ingredient": "紅蔥頭",
        "title": "看起來像蒜，味道卻更甜",
        "fact": "紅蔥頭和大蒜都是地下鱗莖，但紅蔥頭外皮偏紫紅，氣味較柔和，也帶有較細緻的甜味。",
        "prompt": "今天的料理裡，找得到紅蔥頭的香氣嗎？",
        "source": _health_tip_source(5998),
    },
    {
        "keywords": ("韭菜", "韭黃", "韭菜花"),
        "ingredient": "韭菜",
        "title": "同一種植物，可以吃不同部位",
        "fact": "韭菜可吃葉片、花苔；遮住光線栽培，還能長成顏色較淡的韭黃。",
        "prompt": "今天吃到的是綠色韭菜、韭菜花，還是淡黃色韭黃？",
        "source": _health_tip_source(5995),
    },
    {
        "keywords": ("紫菜", "海帶", "味噌"),
        "ingredient": "海藻與發酵味",
        "title": "一碗湯也能找到海洋的味道",
        "fact": "紫菜與海帶來自海洋；味噌則是發酵食品，常被用來替湯品增加香氣與層次。",
        "prompt": "今天的湯聞起來、喝起來，哪一個味道最明顯？",
    },
    {
        "keywords": ("馬頭魚",),
        "ingredient": "馬頭魚",
        "title": "名字來自方方的頭形",
        "fact": "馬頭魚因頭部較方、魚身側扁而得名；秋冬海水轉涼時，通常是較肥美的季節。",
        "prompt": "如果只看頭的形狀，你覺得它像一匹馬嗎？",
        "source": _health_tip_source(6012),
    },
    {
        "keywords": ("魚", "鯖", "鮭", "鱈"),
        "ingredient": "魚料理",
        "title": "同一種食材，可以有不同做法",
        "fact": "魚可以煎、烤、燉或裹上醬汁；烹調方式會改變表面的香氣與魚肉的口感。",
        "prompt": "今天的魚肉比較細嫩，還是比較扎實？你喜歡哪一種做法？",
    },
    {
        "keywords": ("蝦", "蚵", "蛤蜊", "魷魚", "海鮮"),
        "ingredient": "海鮮",
        "title": "來自海裡的不同口感",
        "fact": "蝦、貝類和魷魚雖然都叫海鮮，身體構造與口感卻很不一樣。",
        "prompt": "今天的海鮮是彈、脆、嫩，還是有嚼勁？",
    },
)


GUIDE_CARDS = (
    {
        "keywords": ("糙米", "五穀", "多穀", "燕麥", "小米", "胚芽", "紅藜"),
        "category": "吃得更懂",
        "ingredient": "全穀三要素",
        "title": "麩皮、胚芽和胚乳",
        "fact": "全穀保留麩皮、胚芽和胚乳；加工越精細，留下的部位也會不同。",
        "prompt": "今天的飯看得到不同穀粒嗎？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("糙米", "五穀", "多穀", "燕麥", "小米", "胚芽", "紅藜"),
        "category": "吃得更懂",
        "ingredient": "全穀雜糧",
        "title": "不只白飯，三分之一更有變化",
        "fact": "學校午餐以全穀及未精製雜糧占穀物雜糧三分之一以上為目標。",
        "prompt": "今天的飯裡有哪一種全穀？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "粥", "地瓜", "玉米", "南瓜", "山藥", "芋頭"),
        "category": "吃得更懂",
        "ingredient": "未精製雜糧",
        "title": "地瓜和南瓜也是主食家族",
        "fact": "糙米、燕麥、紅豆、地瓜、玉米、南瓜和山藥，都屬未精製雜糧。",
        "prompt": "今天哪一樣可以算作主食？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("糙米", "五穀", "多穀", "燕麥", "小米", "胚芽", "紅藜"),
        "category": "吃得更懂",
        "ingredient": "一粒全穀",
        "title": "每一層都有自己的任務",
        "fact": "麩皮含纖維、胚芽含多種維生素，胚乳則以醣類提供身體能量。",
        "prompt": "你最喜歡哪一種雜糧飯？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "麵", "粥", "饅頭", "銀絲卷"),
        "category": "吃得更懂",
        "ingredient": "年級與份量",
        "title": "長大一點，午餐份量也會不同",
        "fact": "學校午餐的熱量與食物份量基準會隨年級調整，不必每個孩子都吃一樣多。",
        "prompt": "今天的份量對你剛剛好嗎？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("菜", "瓜", "筍", "菇", "蘿蔔", "海帶"),
        "category": "吃得更懂",
        "ingredient": "深色蔬菜",
        "title": "蔬菜不只看有沒有，也看顏色",
        "fact": "深綠與黃橙紅蔬菜，是學校午餐觀察蔬菜多樣性的重要線索。",
        "prompt": "今天最深色的蔬菜是哪一種？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("菜", "瓜", "筍", "菇", "蘿蔔"),
        "category": "吃得更懂",
        "ingredient": "一份蔬菜",
        "title": "蔬菜份量從可食重量開始算",
        "fact": "午餐檢核以可食生重一百公克作為一份蔬菜，去皮去梗後才計算。",
        "prompt": "今天哪道菜的蔬菜最多？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("豆", "毛豆", "豆腐", "豆干", "豆皮", "腐竹"),
        "category": "吃得更懂",
        "ingredient": "豆類食物",
        "title": "豆腐和毛豆都是蛋白質來源",
        "fact": "毛豆、黃豆、黑豆及豆腐、豆干等豆製品，能增加植物性蛋白質的變化。",
        "prompt": "今天吃到哪一種豆製品？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("魚", "蝦", "魷魚", "蚵", "蛤", "海鮮"),
        "category": "吃得更懂",
        "ingredient": "魚與海鮮",
        "title": "午餐也會觀察魚類出現頻率",
        "fact": "魚類與海鮮是豆魚蛋肉類的一員，學校會按月觀察供應份數。",
        "prompt": "今天的海鮮口感像什麼？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("水果", "蘋果", "香蕉", "火龍果", "奇異果", "藍莓"),
        "category": "吃得更懂",
        "ingredient": "水果供應",
        "title": "水果不是午餐旁邊的裝飾",
        "fact": "水果是學校午餐內容基準的一部分，供應頻率會以一週為單位觀察。",
        "prompt": "今天的水果是酸、甜還是脆？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("炸", "酥", "排", "可樂餅", "雞塊"),
        "category": "吃得更懂",
        "ingredient": "油炸頻率",
        "title": "沒有現炸，也可能算油炸食品",
        "fact": "裹粉油炸、先過油再烹調或使用油炸半成品，都會計入油炸供應頻率。",
        "prompt": "今天哪一道有酥脆外皮？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("紅豆", "綠豆", "薏仁", "地瓜湯", "西米露", "甜湯"),
        "category": "吃得更懂",
        "ingredient": "甜湯",
        "title": "甜湯也能選擇完整食材",
        "fact": "綠豆薏仁、地瓜或紅豆甜湯，適合以低糖方式搭配全穀雜糧。",
        "prompt": "今天的甜味來自哪一種食材？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "菜單設計",
        "title": "菜單不是只算營養就完成",
        "fact": "菜單還要考慮人力、設備、製備時間、季節食材、經費與孩子需求。",
        "prompt": "你猜今天哪一道最費工？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("菜", "瓜", "筍", "菇", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "當季食材",
        "title": "當季，也是一張菜單的線索",
        "fact": "菜單會把在地當季食材、食材特性與廚師熟悉的做法一起納入考量。",
        "prompt": "今天哪一樣最像這個季節？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "菜單異動",
        "title": "臨時換菜，可能是把關的結果",
        "fact": "食材驗收不合格又無法及時補貨時，學校會啟動替代食材與菜單異動。",
        "prompt": "今天有哪一道和菜單不同？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "食材驗收",
        "title": "食材到校，先過六道觀察",
        "fact": "品名、外觀、溫度、重量、認證標章與有效日期，都是食材驗收項目。",
        "prompt": "你買食品時會先看什麼？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("肉", "雞", "豬", "魚", "蛋", "豆", "菜"),
        "category": "午餐怎麼把關",
        "ingredient": "驗收後保存",
        "title": "檢查完，還要立刻放對地方",
        "fact": "完成驗收的食材會盡快前處理，或依特性分類放入乾貨、冷藏或冷凍庫。",
        "prompt": "這項食材應該冷藏還是冷凍？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("菜", "水果", "肉", "雞", "豬", "魚", "蛋", "豆"),
        "category": "午餐怎麼把關",
        "ingredient": "三章一Q",
        "title": "四種標示，幫食材留下線索",
        "fact": "有機、產銷履歷、CAS與溯源標示，是辨認國產可溯源食材的線索。",
        "prompt": "你看過哪一種食材標章？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("菜", "水果", "米", "肉", "雞", "豬", "魚", "蛋"),
        "category": "午餐怎麼把關",
        "ingredient": "產銷履歷",
        "title": "掃一掃，看看食材從哪裡來",
        "fact": "產銷履歷標章可用QR Code查詢履歷資訊，包裝也會標示生產與驗證資料。",
        "prompt": "如果能掃描，你最想查哪一項？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("肉", "雞", "豬", "魚", "蛋", "豆"),
        "category": "午餐怎麼把關",
        "ingredient": "CAS標章",
        "title": "標章也要和完整包裝一起看",
        "fact": "CAS是產品認證；原封包裝、品名、編號與日期都是驗收時的核對重點。",
        "prompt": "包裝上有哪些可以核對的資訊？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "看懂菜單",
        "title": "菜名之外，食材和做法也重要",
        "fact": "完整菜單除了菜名，也應列出主要食材與烹調方式，讓內容更容易理解。",
        "prompt": "今天哪一道最想知道怎麼煮？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("蛋", "魚", "蝦", "奶", "起司", "豆", "芝麻", "麵", "饅頭"),
        "category": "午餐怎麼把關",
        "ingredient": "過敏原提醒",
        "title": "一道菜，也可能藏著過敏原",
        "fact": "菜單會留意蛋、奶、魚、甲殼類、堅果、芝麻、大豆與含麩質穀物等來源。",
        "prompt": "你知道自己要避開哪些食物嗎？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("肉", "雞", "豬", "魚", "蛋", "菜"),
        "category": "午餐怎麼把關",
        "ingredient": "生熟分開",
        "title": "同一把刀，不該一路用到底",
        "fact": "生食與熟食的刀具、砧板和容器要分開，避免看不見的交叉污染。",
        "prompt": "家裡怎麼分辨生熟食砧板？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("肉", "雞", "豬", "魚", "蛋", "菜"),
        "category": "午餐怎麼把關",
        "ingredient": "冰箱分層",
        "title": "污染風險越高，位置要越低",
        "fact": "冰箱分區存放時，生肉等污染風險較高的食材應放下層，避免滴漏污染。",
        "prompt": "家裡的生肉放在哪一層？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "先進先出",
        "title": "寫上日期，才知道誰先用",
        "fact": "乾貨與冷藏食材要標示日期、妥善封口，才能做到先進先出並避免過期。",
        "prompt": "家裡哪一包食材要先吃？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "冷藏冷凍",
        "title": "學校冰箱也有溫度標準",
        "fact": "學校午餐檢核要求冷藏七度以下、冷凍零下十八度以下，並留下紀錄。",
        "prompt": "你看過家裡冰箱的溫度嗎？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯"),
        "category": "午餐怎麼把關",
        "ingredient": "完成餐點",
        "title": "煮好到配膳前，也要好好保護",
        "fact": "完成烹調、等待配膳的餐點會加蓋或採取防護，減少灰塵與接觸污染。",
        "prompt": "今天的餐桶有好好加蓋嗎？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("菜", "瓜", "筍", "菇", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "分區作業",
        "title": "洗滌和切菜，不能在旁邊同時做",
        "fact": "清潔劑洗滌用具與食材截切應分區或分時進行，避免水花造成污染。",
        "prompt": "家裡備餐時會先洗還是先切？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "午餐回饋",
        "title": "說清楚哪一道，意見更有幫助",
        "fact": "回饋菜名、份量、口味、品質與發生情況，比只說好吃或不好吃更容易改善。",
        "prompt": "今天最想稱讚哪一道？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "持續改善",
        "title": "廚餘和補菜紀錄也會說話",
        "fact": "補菜次數、廚餘量與孩子回饋，都能幫助學校調整菜色、口味和份量。",
        "prompt": "今天有哪一道吃得特別乾淨？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "家庭食安",
        "title": "午餐學到的，也能帶回家",
        "fact": "孩子可以和家長一起檢查冰箱分區、食材封口與日期，找出一項改善。",
        "prompt": "今晚想先檢查家裡哪一區？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
    {
        "keywords": ("飯", "菜", "湯", "水果"),
        "category": "午餐怎麼把關",
        "ingredient": "午餐製作",
        "title": "一份午餐，經過很多雙手",
        "fact": "從驗收、清洗、切配、烹調到配膳，每一步都需要分工與衛生紀錄。",
        "prompt": "你最想看看午餐的哪一步？",
        "source": NUTRITIONIST_GUIDE_SOURCE,
    },
)


FOOD_CARDS = FOOD_CARDS + GUIDE_CARDS


RECIPES = (
    {
        "keywords": ("親子丼",),
        "title": "雞肉親子丼",
        "time": "約 25 分鐘",
        "servings": "3–4 人份",
        "ingredients": ("去骨雞腿肉 300 g", "洋蔥 1/2 顆", "雞蛋 3 顆", "醬油 2 大匙、味醂 1 大匙", "白飯 3–4 碗"),
        "steps": ("雞腿切小塊，洋蔥切絲。", "醬油、味醂與半碗水煮滾，放入洋蔥和雞肉。", "雞肉熟後淋入蛋液，蓋鍋煮到喜歡的熟度。", "連同醬汁鋪在白飯上。"),
        "allergens": ("蛋", "大豆", "麩質"),
    },
    {
        "keywords": ("咖哩雞",),
        "title": "蔬菜咖哩雞",
        "time": "約 35 分鐘",
        "servings": "4 人份",
        "ingredients": ("雞腿肉 350 g", "洋蔥 1 顆", "紅蘿蔔 1/2 根", "馬鈴薯 2 顆", "咖哩塊 依包裝建議"),
        "steps": ("雞肉與蔬菜切成一口大小。", "先炒香洋蔥，再放雞肉煎至表面變色。", "加入紅蘿蔔、馬鈴薯與水，煮到蔬菜變軟。", "關小火拌入咖哩塊，煮至濃稠。"),
        "allergens": ("麩質", "奶類；依咖哩塊標示"),
    },
    {
        "keywords": ("雞排",),
        "title": "香草烤雞排",
        "time": "約 30 分鐘",
        "servings": "4 人份",
        "ingredients": ("去骨雞腿排 4 片", "蒜末 1 小匙", "醬油 1 大匙", "乾燥香草 1 小匙", "黑胡椒少許"),
        "steps": ("雞腿排擦乾，以調味料抓醃 15 分鐘。", "皮面朝上放入烤盤。", "以 200°C 烤約 18–22 分鐘，中途視情況翻面。", "確認中心熟透後切片，搭配燙青菜。"),
        "allergens": ("大豆", "麩質"),
    },
    {
        "keywords": ("雞翅",),
        "title": "家常醬燒雞翅",
        "time": "約 35 分鐘",
        "servings": "4 人份",
        "ingredients": ("雞翅 10–12 支", "薑片 4 片", "醬油 2 大匙", "米酒 1 大匙", "水 1 碗"),
        "steps": ("雞翅擦乾，平底鍋煎到兩面上色。", "加入薑片、醬油、米酒與水。", "蓋鍋以小火燜煮約 18 分鐘。", "開蓋收汁，讓醬汁均勻裹上雞翅。"),
        "allergens": ("大豆", "麩質"),
    },
    {
        "keywords": ("鹹水雞", "海南雞", "雞腿"),
        "title": "蔥香嫩雞腿",
        "time": "約 30 分鐘",
        "servings": "4 人份",
        "ingredients": ("去骨雞腿 2 大片", "青蔥 3 支", "薑片 4 片", "鹽 1/2 小匙", "香油少許"),
        "steps": ("雞腿加薑片放入滾水，以小火煮熟。", "關火加蓋燜 8 分鐘，再取出切片。", "青蔥切末，拌入少量鹽和香油。", "將蔥料鋪在雞肉上，搭配米飯與蔬菜。"),
        "allergens": ("芝麻"),
    },
    {
        "keywords": ("魚",),
        "title": "桔香煎魚片",
        "time": "約 25 分鐘",
        "servings": "4 人份",
        "ingredients": ("無刺魚片 4 片", "金桔或檸檬汁 2 大匙", "醬油 1 大匙", "蜂蜜 1 小匙", "薑末少許"),
        "steps": ("魚片擦乾，以少量鹽調味。", "平底鍋薄油將魚片兩面煎熟。", "果汁、醬油、蜂蜜與薑末調勻後入鍋。", "小火收汁，讓酸甜醬汁薄薄裹住魚片。"),
        "allergens": ("魚類", "大豆", "麩質"),
    },
    {
        "keywords": ("豬排",),
        "title": "少油香煎豬排",
        "time": "約 25 分鐘",
        "servings": "4 人份",
        "ingredients": ("里肌豬排 4 片", "蒜末 1 小匙", "醬油 1.5 大匙", "米酒 1 大匙", "白胡椒少許"),
        "steps": ("豬排拍鬆，以調味料醃 15 分鐘。", "平底鍋放少量油，以中火煎第一面。", "翻面後加蓋煎至中心熟透。", "靜置 2 分鐘再切片，肉汁較不易流失。"),
        "allergens": ("大豆", "麩質"),
    },
    {
        "keywords": ("蒜泥白肉",),
        "title": "蒜泥肉片佐小黃瓜",
        "time": "約 20 分鐘",
        "servings": "4 人份",
        "ingredients": ("火鍋豬肉片 300 g", "小黃瓜 2 條", "蒜末 1 大匙", "醬油 1.5 大匙", "烏醋 1 大匙"),
        "steps": ("小黃瓜刨薄片，鋪在盤底。", "豬肉片放入滾水中汆燙至熟，瀝乾。", "蒜末、醬油、烏醋與一匙水調成醬汁。", "肉片放上小黃瓜，吃之前淋醬。"),
        "allergens": ("大豆", "麩質"),
    },
    {
        "keywords": ("豬腳",),
        "title": "家庭版可樂豬腳",
        "time": "約 70 分鐘",
        "servings": "4–5 人份",
        "ingredients": ("豬腳 800 g", "無糖可樂 330 ml", "醬油 4 大匙", "薑片 6 片", "青蔥 2 支"),
        "steps": ("豬腳汆燙後洗淨。", "鍋中放豬腳、薑片、蔥段、醬油與無糖可樂。", "補水至大致蓋過食材，小火燉約 55 分鐘。", "確認軟嫩後開蓋收汁；使用無糖可樂可減少額外甜味。"),
        "allergens": ("大豆", "麩質"),
    },
    {
        "keywords": ("豬肉", "燴炒"),
        "title": "洋蔥醬燒豬肉",
        "time": "約 20 分鐘",
        "servings": "4 人份",
        "ingredients": ("豬肉片 300 g", "洋蔥 1 顆", "醬油 1.5 大匙", "米酒 1 大匙", "白芝麻少許"),
        "steps": ("洋蔥切絲，豬肉片以少量醬油抓醃。", "先炒軟洋蔥，再加入豬肉片。", "加入剩餘醬油與米酒，炒至肉片熟透。", "起鍋前撒上少量白芝麻。"),
        "allergens": ("大豆", "麩質", "芝麻"),
    },
    {
        "keywords": ("豆腐",),
        "title": "蔬菜鐵板豆腐",
        "time": "約 25 分鐘",
        "servings": "4 人份",
        "ingredients": ("板豆腐 1 盒", "洋蔥 1/2 顆", "甜椒 1 顆", "醬油 1 大匙", "番茄醬 1 大匙"),
        "steps": ("豆腐擦乾切厚片，兩面煎至金黃。", "原鍋炒香洋蔥與甜椒。", "加入醬油、番茄醬和少量水。", "放回豆腐，小火燴煮至入味。"),
        "allergens": ("大豆", "麩質"),
    },
    {
        "keywords": ("炒蛋", "蒸蛋", "滷蛋", "蛋花", "起司蛋"),
        "title": "彩色蔬菜烘蛋",
        "time": "約 20 分鐘",
        "servings": "4 人份",
        "ingredients": ("雞蛋 4 顆", "玉米粒 3 大匙", "紅蘿蔔末 2 大匙", "青蔥 1 支", "牛奶或無糖豆漿 2 大匙"),
        "steps": ("雞蛋與牛奶打勻。", "蔬菜先炒至略軟，再均勻鋪平。", "倒入蛋液，以小火加蓋煎熟。", "切成小塊，搭配主食與青菜。"),
        "allergens": ("蛋", "奶類或大豆"),
    },
)

VEGETARIAN_RECIPES = (
    {
        "keywords": ("豆腐", "豆干", "豆包", "豆腸", "豆輪", "烤麩"),
        "title": "彩蔬豆腐煲",
        "time": "約 25 分鐘",
        "servings": "4 人份",
        "ingredients": ("板豆腐 1 盒", "高麗菜 1/4 顆", "菇類 1 碗", "紅蘿蔔 1/3 根", "醬油 1 大匙"),
        "steps": ("豆腐切塊煎至表面金黃。", "蔬菜與菇類切成適口大小。", "鍋中加入蔬菜、少量水與醬油煮軟。", "放回豆腐，小火燴至入味。"),
        "allergens": ("大豆", "麩質"),
    },
    {
        "keywords": ("蛋", "起司"),
        "title": "菇菇蔬菜烘蛋",
        "time": "約 20 分鐘",
        "servings": "4 人份",
        "ingredients": ("雞蛋 4 顆", "綜合菇 1 碗", "甜椒 1/2 顆", "牛奶或無糖豆漿 2 大匙", "鹽少許"),
        "steps": ("菇類與甜椒切小塊。", "雞蛋與牛奶打勻。", "先炒香蔬菜，再倒入蛋液。", "小火加蓋煎熟後切塊。"),
        "allergens": ("蛋", "奶類或大豆"),
    },
    {
        "keywords": (),
        "title": "毛豆菇菇炊飯",
        "time": "約 35 分鐘",
        "servings": "4 人份",
        "ingredients": ("白米 2 杯", "毛豆仁 1/2 杯", "綜合菇 1 碗", "紅蘿蔔丁 1/3 杯", "醬油 1 大匙"),
        "steps": ("白米洗淨後依平常水量入鍋。", "菇類切片，與毛豆、紅蘿蔔鋪在米上。", "加入醬油後照一般炊飯程序煮熟。", "燜 10 分鐘後拌勻。"),
        "allergens": ("大豆", "麩質"),
    },
)


def make_food_education(day: dict[str, Any]) -> dict[str, Any]:
    items = _menu_items(day)
    matching = [
        card
        for card in FOOD_CARDS
        if any(keyword in item for keyword in card["keywords"] for item in items)
    ]
    if matching:
        featured_matching = [
            card
            for card in matching
            if day["date"] in card.get("featured_dates", ())
        ]
        selection_pool = featured_matching or matching
        seed = _stable_index(day["date"], len(selection_pool))
        selected = selection_pool[seed]
        source = selected.get("source", FOOD_EDUCATION_SOURCE)
        payload = {
            key: value
            for key, value in selected.items()
            if key not in {"keywords", "source", "featured_dates"}
        }
    else:
        main_dish = day["meal"]["mainDish"]
        source = FOOD_EDUCATION_SOURCE
        payload = {
            "ingredient": main_dish,
            "title": "一道料理，藏著不只一種線索",
            "fact": "食材、調味和烹調方式會一起決定一道菜的香氣、顏色與口感。仔細觀察，就能找出它的特色。",
            "prompt": f"如果要形容「{main_dish}」，你會選香、甜、鹹、脆、嫩裡的哪一個字？",
            "category": "吃得更懂",
        }
    payload.setdefault("category", "吃得更懂")
    return {**payload, "source": source}


def make_home_recipe(day: dict[str, Any]) -> dict[str, Any]:
    if day.get("mealType") == "vegetarian":
        items = _menu_items(day)
        for item in items:
            for recipe in VEGETARIAN_RECIPES[:-1]:
                if any(keyword in item for keyword in recipe["keywords"]):
                    return _recipe_payload(recipe, item)
        fallback = VEGETARIAN_RECIPES[-1]
        return _recipe_payload(fallback, day["meal"]["mainDish"])
    for item in _menu_items(day):
        for recipe in RECIPES:
            if any(keyword in item for keyword in recipe["keywords"]):
                return _recipe_payload(recipe, item)

    fallback = RECIPES[_stable_index(day["date"], len(RECIPES))]
    return _recipe_payload(fallback, day["meal"]["mainDish"])


def _recipe_payload(recipe: dict[str, Any], inspired_by: str) -> dict[str, Any]:
    return {
        "title": recipe["title"],
        "inspiredBy": inspired_by,
        "time": recipe["time"],
        "servings": recipe["servings"],
        "ingredients": list(recipe["ingredients"]),
        "steps": list(recipe["steps"]),
        "allergens": list(recipe["allergens"]),
        "note": "依菜名設計的家庭靈感版，並非校方或供餐廠商原始配方。",
    }


def _menu_items(day: dict[str, Any]) -> list[str]:
    meal = day["meal"]
    return [
        str(item)
        for item in (
            meal.get("mainDish"),
            *meal.get("sideDishes", []),
            meal.get("soup"),
            meal.get("fruit"),
            meal.get("drink"),
            meal.get("staple"),
        )
        if item
    ]


def _stable_index(value: str, size: int) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") % size
