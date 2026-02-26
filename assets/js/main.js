(() => {
  const BUTTONS_JSON_URL = "buttons.json";

  const STATE_CLASS_MAP = {
    default: "answer-button--default",
    hovered: "answer-button--hovered",
    active: "answer-button--active",
    correct: "answer-button--correct",
    incorrect: "answer-button--incorrect",
    disabled: "answer-button--disabled"
  };
  const ALL_STATE_CLASSES = Object.values(STATE_CLASS_MAP);
  const quizRootElement = document.querySelector(".quiz-screen");
  const answerGridElement = document.getElementById("answerGrid");
  const answerStatusElement = document.getElementById("answerStatus");
  const questionValueElement = document.getElementById("questionValue");
  const answerDataElement = document.getElementById("answerButtonsData");

  if (!quizRootElement || !answerGridElement) {
    return;
  }

  initQuiz().catch((error) => {
    console.error("Quiz initialization failed", error);
    if (answerStatusElement) {
      answerStatusElement.textContent = "Не удалось загрузить варианты ответа.";
    }
  });

  async function initQuiz() {
    const parsedData = await resolveButtonsData();

    if (!parsedData || !Array.isArray(parsedData.buttons) || parsedData.buttons.length === 0) {
      if (answerStatusElement) {
        answerStatusElement.textContent = "Не удалось загрузить варианты ответа.";
      }
      return;
    }

    const normalizedButtons = parsedData.buttons.map(normalizeButtonData).filter(Boolean);

    if (normalizedButtons.length === 0) {
      if (answerStatusElement) {
        answerStatusElement.textContent = "Не удалось загрузить варианты ответа.";
      }
      return;
    }

    const correctPublicId =
      quizRootElement.dataset.correctPublicId || normalizedButtons[0].publicId || "";

    const questionLabel =
      quizRootElement.dataset.questionLabel ||
      normalizedButtons.find((button) => button.publicId === correctPublicId)?.name ||
      normalizedButtons[0].name ||
      "";

    if (questionValueElement) {
      questionValueElement.textContent = questionLabel;
    }

    const quizState = {
      isAnswered: false,
      selectedPublicId: null
    };

    const answerButtonElements = [];

    normalizedButtons.forEach((buttonData) => {
      const buttonElement = createAnswerButton(
        buttonData,
        quizState,
        correctPublicId,
        answerButtonElements
      );

      answerButtonElements.push(buttonElement);
      answerGridElement.appendChild(buttonElement);
    });
  }

  async function resolveButtonsData() {
    const inlineData = parseButtonsData(answerDataElement?.textContent || "");
    if (inlineData && Array.isArray(inlineData.buttons) && inlineData.buttons.length > 0) {
      return inlineData;
    }

    return fetchButtonsData(BUTTONS_JSON_URL);
  }

  async function fetchButtonsData(url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Failed to load buttons JSON", error);
      return null;
    }
  }

  function normalizeButtonData(rawButtonData, buttonIndex) {
    if (!rawButtonData || typeof rawButtonData !== "object") {
      return null;
    }

    const fallbackLabel = `Ответ ${buttonIndex + 1}`;

    return {
      publicId: rawButtonData.publicId || `answer-${buttonIndex + 1}`,
      name: rawButtonData.name || rawButtonData.textContent || fallbackLabel,
      textContent: rawButtonData.textContent || rawButtonData.name || fallbackLabel,
      description: rawButtonData.description || rawButtonData.name || "",
      pictureUrl: rawButtonData.picture?.url || "",
      pictureAlt: rawButtonData.picture?.alt || "",
      backgroundUrl: rawButtonData.background?.url || ""
    };
  }

  function createAnswerButton(buttonData, state, expectedId, allButtons) {
    const buttonElement = document.createElement("button");
    buttonElement.type = "button";
    buttonElement.className = `answer-button ${STATE_CLASS_MAP.default}`;
    buttonElement.dataset.state = "default";
    buttonElement.dataset.publicId = buttonData.publicId;
    buttonElement.dataset.answerLabel = buttonData.name || buttonData.textContent;
    buttonElement.setAttribute("role", "option");
    buttonElement.setAttribute("aria-pressed", "false");

    if (buttonData.backgroundUrl) {
      // Convert path relative to style.css: assets/images/quiz_btn1.png -> ../images/quiz_btn1.png
      const relativePath = buttonData.backgroundUrl.replace('assets/images/', '../images/');
      buttonElement.style.setProperty("--answer-bg-image", `url('${relativePath}')`);
    }

    const flagElement = document.createElement("span");
    flagElement.className = "answer-button__flag";

    const flagImageElement = document.createElement("img");
    flagImageElement.className = "answer-button__flag-image";
    flagImageElement.src = buttonData.pictureUrl;
    flagImageElement.alt = buttonData.pictureAlt;
    flagImageElement.loading = "lazy";
    flagImageElement.addEventListener("error", () => {
      flagImageElement.classList.add("answer-button__flag-image--hidden");
    });

    const contentElement = document.createElement("span");
    contentElement.className = "answer-button__content";

    const textElement = document.createElement("span");
    textElement.className = "answer-button__text";
    textElement.textContent = buttonData.textContent;

    const descriptionElement = document.createElement("span");
    descriptionElement.className = "answer-button__description";
    descriptionElement.textContent = buttonData.description || buttonData.name;

    flagElement.appendChild(flagImageElement);
    contentElement.appendChild(textElement);
    contentElement.appendChild(descriptionElement);
    buttonElement.appendChild(flagElement);
    buttonElement.appendChild(contentElement);

    buttonElement.addEventListener("pointerenter", () => {
      applyTransientState(buttonElement, state, "hovered");
    });

    buttonElement.addEventListener("pointerleave", () => {
      applyTransientState(buttonElement, state, "default");
    });

    buttonElement.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      applyTransientState(buttonElement, state, "active");
    });

    buttonElement.addEventListener("pointerup", () => {
      applyTransientState(buttonElement, state, "hovered");
    });

    buttonElement.addEventListener("pointercancel", () => {
      applyTransientState(buttonElement, state, "default");
    });

    buttonElement.addEventListener("focus", () => {
      applyTransientState(buttonElement, state, "hovered");
    });

    buttonElement.addEventListener("blur", () => {
      applyTransientState(buttonElement, state, "default");
    });

    buttonElement.addEventListener("click", () => {
      if (state.isAnswered) {
        return;
      }

      state.isAnswered = true;
      state.selectedPublicId = buttonElement.dataset.publicId;

      const isCorrectSelection = buttonElement.dataset.publicId === expectedId;
      finalizeAnswers(allButtons, buttonElement, isCorrectSelection);

      if (answerStatusElement) {
        const answerLabel = buttonElement.dataset.answerLabel || "";
        answerStatusElement.classList.remove(
          "quiz-answers__status--correct",
          "quiz-answers__status--incorrect"
        );
        answerStatusElement.classList.add(
          isCorrectSelection ? "quiz-answers__status--correct" : "quiz-answers__status--incorrect"
        );
        answerStatusElement.textContent = isCorrectSelection
          ? `Верно: ${answerLabel}.`
          : `Неверно: ${answerLabel}.`;
      }
    });

    return buttonElement;
  }

  function applyTransientState(buttonElement, state, nextState) {
    if (state.isAnswered || buttonElement.disabled) {
      return;
    }
    setButtonState(buttonElement, nextState);
  }

  function finalizeAnswers(allButtons, selectedButton, isCorrectSelection) {
    answerGridElement.classList.add("answer-grid--locked");
    answerGridElement.classList.add(
      isCorrectSelection ? "answer-grid--result-correct" : "answer-grid--result-incorrect"
    );

    allButtons.forEach((buttonElement) => {
      const isSelected = buttonElement === selectedButton;

      buttonElement.disabled = true;
      buttonElement.setAttribute("aria-disabled", "true");

      if (isSelected) {
        setButtonState(buttonElement, isCorrectSelection ? "correct" : "incorrect");
        buttonElement.classList.add("answer-button--selected");
        buttonElement.setAttribute("aria-pressed", "true");
        return;
      }

      setButtonState(buttonElement, "disabled");
      buttonElement.setAttribute("aria-pressed", "false");
    });
  }

  function setButtonState(buttonElement, nextState) {
    buttonElement.classList.remove(...ALL_STATE_CLASSES);
    buttonElement.classList.add(STATE_CLASS_MAP[nextState] || STATE_CLASS_MAP.default);
    buttonElement.dataset.state = nextState;
  }

  function parseButtonsData(rawData) {
    if (!rawData || !rawData.trim()) {
      return null;
    }

    try {
      return JSON.parse(rawData);
    } catch (error) {
      console.error("Invalid answer buttons JSON", error);
      return null;
    }
  }
})();
