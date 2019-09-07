import React from 'react';

export default function RankingFaq() {
  return (
    <div className="faq">
      <div className="question-answer">
        <div className="question">Q: Как считается рейтинг?</div>
        <div className="answer">
          A: Используется <a href="https://en.wikipedia.org/wiki/Elo_rating_system">рейтинг Эло</a>,
          широко используемый в шахматах и других играх, слегка модицированный под условия игры на
          пампе. Средний рейтинг - 1000. Коэффициент К зависит от уровня чарта (более сложные чарты
          сильнее влияют на рейтинг). Количество очков влияет на заработанный рейтинг (маленький
          отрыв от противника не даст так много очков как большой отрыв).
        </div>
      </div>
      <div className="question-answer">
        <div className="question">
          Q: Система Эло используется для игр 1 на 1, как она используется на пампе, где на одном
          чарте играет много игроков?
        </div>
        <div className="answer">
          A: Рекорды на одном чарте делятся на несколько игр 1 на 1. Если есть 3 игрока: A, B, C; то
          считается, что было 3 отдельные игры: A vs B, A vs C, B vs C.
        </div>
      </div>
      <div className="question-answer">
        <div className="question">Q: Учитываются ли рекорды на ранке в рейтинге?</div>
        <div className="answer">
          A: Да. Как минимум потому что у нас есть много рекордов, взятых с машин бестов, и мы не
          знаем наверняка, на ранке они или нет. Если у игрока в топе есть два скора - на ранке и
          без ранка, используется тот, где больше очков.
        </div>
      </div>
      <div className="question-answer">
        <div className="question">Q: Почему меня нет в рейтинге?</div>
        <div className="answer">
          A: В таблицу попадают только те, у кого есть хотя бы 20 игр 1 на 1. Первые 20 игр
          используются для определения изначального рейтинга.
        </div>
      </div>
      <div className="question-answer">
        <div className="question">
          Q: Почему суммарное количество оценок S-A-B не совпадает с общим количеством скоров?
        </div>
        <div className="answer">A: Не для каждого результата известна оценка.</div>
      </div>
      <div className="question-answer">
        <div className="question">
          Q: Если у меня есть несколько рекордов на А, несколько на А+, как считается суммарное
          количество грейдов в таблице?
        </div>
        <div className="answer">
          A: В каждой колонке учитываются обе буквы - и треснутые, и с удержанным лайфом. То есть и
          А, и А+ идут в колонку А. Точно так же для B, C, D.
        </div>
      </div>
      <div className="question-answer">
        <div className="question">Q: Убери аккураси из таблицы!</div>
        <div className="answer">A: Грем, это секция для вопросов.</div>
      </div>
    </div>
  );
}
