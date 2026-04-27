import { base } from "$app/paths";

// Маппинг категорий каталога на иконки stv39.ru.
// Сами SVG лежат в static/icons/categories/, скачаны с сайта магазина —
// чтобы единый стиль с stv39.ru (где этими иконками пользуются клиенты).
//
// Цвета на каждую категорию подобраны под общий темно-синий стиль ЭЦ.
// Если в каталоге появится новая категория — добавить запись и (опционально)
// положить новый SVG. Без записи возвращается дефолтная иконка-пакет.

const MAP = {
	"Автоматика и Щиты":         { icon: "q1.svg",  color: "#DC2626" }, // красный — внимание/защита
	"Кабель и провод":           { icon: "q2.svg",  color: "#1E3A6E" }, // фирменный синий
	"Лампы":                     { icon: "q3.svg",  color: "#D97706" }, // янтарный
	"Осветительное оборудование": { icon: "q4.svg",  color: "#D97706" },
	"Измерительные приборы":     { icon: "q5.svg",  color: "#7C3AED" }, // фиолетовый — точность
	"Розетки и выключатели":     { icon: "q6.svg",  color: "#059669" }, // зелёный
	"Инструмент ручной":         { icon: "q7.svg",  color: "#0891B2" }, // циан
	"Электроинструмент":         { icon: "q8.svg",  color: "#0891B2" },
	"Климат-контроль":           { icon: "q9.svg",  color: "#0EA5E9" }, // голубой
	"Бытовые и садовые товары":  { icon: "q10.svg", color: "#16A34A" }, // зелень
	"Электромонтаж":             { icon: "q11.svg", color: "#1E3A6E" },
	"Строительное оборудование": { icon: "q12.svg", color: "#737373" }, // серый
	"Товары для автомобиля":     { icon: "q13.svg", color: "#475569" }, // тёмно-серый
};

// Возвращает {iconUrl, color} для категории. Если не нашли — null.
export function categoryIcon(category) {
	if (!category) return null;
	const direct = MAP[category];
	if (direct) return { iconUrl: `${base}/icons/categories/${direct.icon}`, color: direct.color };

	// Fallback — поиск по prefix (если в каталоге будут варианты типа
	// «Автоматика и щиты» с маленькой буквы или с уточнениями)
	for (const [key, val] of Object.entries(MAP)) {
		if (category.toLowerCase().startsWith(key.toLowerCase().slice(0, 8))) {
			return { iconUrl: `${base}/icons/categories/${val.icon}`, color: val.color };
		}
	}
	return null;
}
