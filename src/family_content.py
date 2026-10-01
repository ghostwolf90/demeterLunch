from __future__ import annotations

import hashlib
from typing import Any


FOOD_EDUCATION_SOURCE = {
    "label": "食育設計參考：日本文部科學省",
    "url": "https://www.mext.go.jp/a_menu/01_k.htm",
}


FOOD_CARDS = (
    {
        "keywords": ("青江菜", "油菜", "小松菜", "空心菜", "菠菜", "萵苣", "味美菜"),
        "ingredient": "葉菜",
        "title": "葉子和菜梗，口感不一樣",
        "fact": "同一株葉菜裡，葉片通常較柔軟，菜梗則保留更多脆度。慢慢咀嚼，就能發現兩種口感。",
        "prompt": "今天吃到的青菜，是葉子比較好吃，還是菜梗比較好吃？",
    },
    {
        "keywords": ("白菜", "高麗", "酸菜"),
        "ingredient": "白菜與高麗菜",
        "title": "一層一層包起來的蔬菜",
        "fact": "白菜和高麗菜的葉片會層層包覆；切絲、燉煮或快炒，會呈現完全不同的口感。",
        "prompt": "今天的菜是脆脆的，還是吸滿湯汁、軟軟的？",
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
    },
    {
        "keywords": ("地瓜", "馬鈴薯", "芋頭"),
        "ingredient": "根莖類",
        "title": "藏在土裡的食材",
        "fact": "地瓜、馬鈴薯和芋頭可食用的部位生長在土裡；蒸、烤、煮，質地會各有不同。",
        "prompt": "今天吃到的是綿密、鬆軟，還是帶一點彈性？",
    },
    {
        "keywords": ("玉米",),
        "ingredient": "玉米",
        "title": "玉米粒為什麼排得這麼整齊？",
        "fact": "每一顆玉米粒都是一粒種子，沿著玉米穗排列成一整圈又一整圈。",
        "prompt": "下次看到整根玉米，可以觀察每一排是不是完全筆直。",
    },
    {
        "keywords": ("紫菜", "海帶", "味噌"),
        "ingredient": "海藻與發酵味",
        "title": "一碗湯也能找到海洋的味道",
        "fact": "紫菜與海帶來自海洋；味噌則是發酵食品，常被用來替湯品增加香氣與層次。",
        "prompt": "今天的湯聞起來、喝起來，哪一個味道最明顯？",
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


def make_food_education(day: dict[str, Any]) -> dict[str, Any]:
    items = _menu_items(day)
    matching = [
        card
        for card in FOOD_CARDS
        if any(keyword in item for keyword in card["keywords"] for item in items)
    ]
    if matching:
        seed = _stable_index(day["date"], len(matching))
        selected = matching[seed]
        payload = {key: value for key, value in selected.items() if key != "keywords"}
    else:
        main_dish = day["meal"]["mainDish"]
        payload = {
            "ingredient": main_dish,
            "title": "一道料理，藏著不只一種線索",
            "fact": "食材、調味和烹調方式會一起決定一道菜的香氣、顏色與口感。仔細觀察，就能找出它的特色。",
            "prompt": f"如果要形容「{main_dish}」，你會選香、甜、鹹、脆、嫩裡的哪一個字？",
        }
    return {**payload, "source": FOOD_EDUCATION_SOURCE}


def make_home_recipe(day: dict[str, Any]) -> dict[str, Any]:
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
