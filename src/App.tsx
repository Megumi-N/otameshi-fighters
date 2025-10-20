import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';

// Constants
const GAME_CONFIG = {
  MAX_TURNS: 10,
  MAX_CHOSHI: 100,
  ANIMATION_FRAMES: 8,
  ANIMATION_DELAY: 100,
  TURN_DELAY: 1500,
  CANVAS_WIDTH: 160,
  CANVAS_HEIGHT: 144,
} as const;

// Game Boy palette
const colors = {
  darkest: '#0f380f',
  dark: '#306230',
  light: '#8bac0f',
  lightest: '#9bbc0f',
} as const;

// Types
type ResponseChoice = 0 | 1 | 2 | 3;
type OjiSanMood = 'neutral' | 'angry' | 'happy';

interface Statement {
  text: string;
  correct: ResponseChoice;
  type: string;
  responses: [string, string, string, string];
}

interface GameState {
  choshi: number;
  turn: number;
  isGameOver: boolean;
  currentStatement: Statement | null;
  ojiSanMood: OjiSanMood;
  ojiSanPos: number;
  consecutiveFails: number;
  showVictoryEffect: boolean;
}

interface ResponseEffect {
  0: number;
  1: number;
  2: number;
  3: number;
}

// おためし statements with correct responses
const statements: Statement[] = [
  // 質問返し
  {
    text: '「それ、前にも言わなかった?」',
    correct: 3,
    type: 'doubt',
    responses: [
      '「...そうでしたっけ」',
      '「議事録を確認します」',
      '「すみません、もう一度」',
      '「いつ言いましたか?」',
    ],
  },
  {
    text: '「本当にそれでいいの?」',
    correct: 3,
    type: 'concern',
    responses: [
      '「はい、大丈夫です」',
      '「根拠はこちらです」',
      '「ご心配ありがとうございます」',
      '「どの点が気になりますか?」',
    ],
  },
  {
    text: '「それ、誰が決めたの?」',
    correct: 3,
    type: 'doubt',
    responses: [
      '「チームで決めました」',
      '「こういう理由です」',
      '「みんなで相談しました」',
      '「どなたの承認が必要ですか?」',
    ],
  },
  {
    text: '「リスク考えた?」',
    correct: 3,
    type: 'concern',
    responses: [
      '「はい、考えました」',
      '「対策はこちらです」',
      '「ご指摘感謝します」',
      '「どんなリスクを想定されてますか?」',
    ],
  },
  // 論理修正
  {
    text: '「もっと良い方法あるよね」',
    correct: 1,
    type: 'suggestion',
    responses: [
      '「そうかもしれませんね」',
      '「具体案を教えてください」',
      '「ぜひご提案ください」',
      '「どういう方法ですか?」',
    ],
  },
  {
    text: '「前例はあるの?」',
    correct: 1,
    type: 'doubt',
    responses: [
      '「調べてみます」',
      '「新しい試みです」',
      '「参考になります」',
      '「前例が必要ですか?」',
    ],
  },
  {
    text: '「それって意味ある?」',
    correct: 1,
    type: 'doubt',
    responses: [
      '「意味あると思います」',
      '「目的はこれです」',
      '「検討してみます」',
      '「どの点が疑問ですか?」',
    ],
  },
  // スルー
  {
    text: '「俺だったらこうするけどな」',
    correct: 0,
    type: 'ego',
    responses: [
      '「なるほど、参考にします」',
      '「それも一つの案ですね」',
      '「さすがですね」',
      '「詳しく教えてください」',
    ],
  },
  {
    text: '「まあ、君の好きにしたら?」',
    correct: 0,
    type: 'passive',
    responses: [
      '「ありがとうございます」',
      '「方向性を確認させてください」',
      '「ご意見いただけますか」',
      '「本当によろしいですか?」',
    ],
  },
  {
    text: '「俺の経験だとね...」',
    correct: 0,
    type: 'story',
    responses: [
      '「勉強になります」',
      '「今回のケースだと...」',
      '「貴重なお話ですね」',
      '「それはいつ頃ですか?」',
    ],
  },
  {
    text: '「ふーん、そうなんだ」',
    correct: 0,
    type: 'dismissive',
    responses: [
      '「はい、そうなんです」',
      '「詳細を説明します」',
      '「ご理解いただけましたか」',
      '「何か気になる点は?」',
    ],
  },
  // 共感
  {
    text: '「まあ頑張ってね」',
    correct: 2,
    type: 'passive',
    responses: [
      '「頑張ります」',
      '「サポートをお願いします」',
      '「ありがとうございます」',
      '「具体的に何をすれば?」',
    ],
  },
  {
    text: '「若い人の考えは面白いね」',
    correct: 2,
    type: 'patronizing',
    responses: [
      '「そうですか」',
      '「データに基づいています」',
      '「お褒めいただき光栄です」',
      '「どこが面白いですか?」',
    ],
  },
  {
    text: '「俺は反対じゃないけど...」',
    correct: 2,
    type: 'passive',
    responses: [
      '「わかりました」',
      '「懸念点を教えてください」',
      '「ご理解感謝します」',
      '「何が引っかかりますか?」',
    ],
  },
  {
    text: '「本当に大丈夫?」',
    correct: 2,
    type: 'concern',
    responses: [
      '「大丈夫です」',
      '「こういう準備をしています」',
      '「ご心配ありがとうございます」',
      '「何を確認すれば安心ですか?」',
    ],
  },
];

// Response effects: choshi change when CORRECT
const responseEffects: ResponseEffect = {
  0: 0, // スルー - 維持（やり過ごす）
  1: -5, // 論理修正 - 減少（的確に対応）
  2: -8, // 共感 - やや減少（場を和ませる）
  3: -10, // 質問返し - 大幅減少（主導権を取る）
};

// Penalty when INCORRECT
const incorrectPenalty: ResponseEffect = {
  0: 20, // スルー失敗 - 大幅増加
  1: 15, // 論理修正失敗 - 増加
  2: 12, // 共感失敗 - やや増加
  3: 18, // 質問返し失敗 - 増加
};

// Success messages for each response type
const successMessages: Record<ResponseChoice, string> = {
  0: 'うまい対応だ!',
  1: '効果的な切り返し!',
  2: 'おじさんが黙った...',
  3: '場が収まった!',
};

// Failure messages for each response type
const failureMessages: Record<ResponseChoice, string> = {
  0: 'ノリノリに...',
  1: '論理が通じずヒートアップ...',
  2: '共感が裏目に出た...',
  3: '質問返しが火に油...',
};

// Status messages based on choshi level (every 20%)
const getStatusMessage = (choshi: number): string => {
  if (choshi >= 100) return '【もう無理...】';
  if (choshi >= 80) return '【限界寸前！】';
  if (choshi >= 60) return '【かなり厳しい】';
  if (choshi >= 40) return '【対応が大変】';
  if (choshi >= 20) return '【少し疲れてきた】';
  return '【まだ余裕】';
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    choshi: 0,
    turn: 0,
    isGameOver: false,
    currentStatement: null,
    ojiSanMood: 'neutral',
    ojiSanPos: 0,
    consecutiveFails: 0,
    showVictoryEffect: false,
  });
  const [message, setMessage] = useState<string>(
    '会議が始まります...\n\nあなたは会議に参加している会社員。\n無意識に相手を試す言動をする、\n「おためしおじさん」に対応しなければならない。\n\nおためしおじさんは確実にあなたのメンタルを削ってくる。\nおためしおじさんの対応を会議中やりきることができるか...\n\n...準備はいいですか？\n\n【クリックして開始】'
  );
  const [buttonsDisabled, setButtonsDisabled] = useState<boolean>(true);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  const drawPixel = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string
  ): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };

  const drawRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  const drawBackground = (ctx: CanvasRenderingContext2D): void => {
    // Floor
    drawRect(ctx, 0, 100, 160, 44, colors.light);

    // Table
    drawRect(ctx, 20, 90, 120, 50, colors.dark);
    drawRect(ctx, 20, 88, 120, 2, colors.darkest);

    // Wall
    drawRect(ctx, 0, 0, 160, 100, colors.lightest);

    // Window
    drawRect(ctx, 10, 10, 40, 40, colors.light);
    drawRect(ctx, 29, 10, 2, 40, colors.dark);
    drawRect(ctx, 10, 29, 40, 2, colors.dark);

    // Door
    drawRect(ctx, 120, 30, 30, 60, colors.dark);
    drawRect(ctx, 145, 55, 3, 3, colors.darkest);
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D): void => {
    const x = 40;
    const y = 70;

    // Head
    drawRect(ctx, x, y, 8, 8, colors.light);

    // Hair - bob cut style (feminine)
    drawRect(ctx, x - 1, y - 2, 10, 3, colors.darkest); // Top and sides
    drawRect(ctx, x - 1, y + 1, 2, 4, colors.darkest); // Left side long
    drawRect(ctx, x + 7, y + 1, 2, 4, colors.darkest); // Right side long

    // Bangs
    drawPixel(ctx, x + 1, y, colors.darkest);
    drawPixel(ctx, x + 3, y, colors.darkest);
    drawPixel(ctx, x + 6, y, colors.darkest);

    // Eyes (larger, more feminine)
    drawPixel(ctx, x + 2, y + 3, colors.darkest);
    drawPixel(ctx, x + 2, y + 4, colors.darkest);
    drawPixel(ctx, x + 5, y + 3, colors.darkest);
    drawPixel(ctx, x + 5, y + 4, colors.darkest);

    // Mouth (small smile)
    drawPixel(ctx, x + 3, y + 6, colors.darkest);
    drawPixel(ctx, x + 4, y + 6, colors.darkest);

    // Jacket (upper body)
    drawRect(ctx, x, y + 8, 8, 8, colors.darkest);

    // Shirt collar
    drawPixel(ctx, x + 3, y + 8, colors.lightest);
    drawPixel(ctx, x + 4, y + 8, colors.lightest);

    // Arms (jacket sleeves)
    drawRect(ctx, x - 2, y + 10, 2, 6, colors.darkest);
    drawRect(ctx, x + 8, y + 10, 2, 6, colors.darkest);

    // Pants (lower body)
    drawRect(ctx, x + 1, y + 16, 3, 8, colors.dark);
    drawRect(ctx, x + 4, y + 16, 3, 8, colors.dark);
  };

  const drawOjisan = (
    ctx: CanvasRenderingContext2D,
    mood: 'neutral' | 'angry' | 'happy',
    pos: number
  ): void => {
    const x = 100 + Math.floor(pos);
    const y = 70;

    // Head
    drawRect(ctx, x, y, 10, 10, colors.light);

    // Hair
    drawRect(ctx, x + 1, y - 2, 8, 3, colors.darkest);

    // Glasses
    drawRect(ctx, x + 1, y + 4, 3, 3, colors.darkest);
    drawRect(ctx, x + 6, y + 4, 3, 3, colors.darkest);
    drawRect(ctx, x + 4, y + 5, 2, 1, colors.darkest);

    // Expression
    if (mood === 'angry') {
      // Angry mouth
      drawRect(ctx, x + 2, y + 8, 6, 1, colors.darkest);
      // Angry eyebrows
      drawPixel(ctx, x + 1, y + 3, colors.darkest);
      drawPixel(ctx, x + 2, y + 2, colors.darkest);
      drawPixel(ctx, x + 7, y + 2, colors.darkest);
      drawPixel(ctx, x + 8, y + 3, colors.darkest);
    } else if (mood === 'happy') {
      // Happy mouth (smile)
      drawPixel(ctx, x + 2, y + 7, colors.darkest);
      drawRect(ctx, x + 3, y + 8, 4, 1, colors.darkest);
      drawPixel(ctx, x + 7, y + 7, colors.darkest);
    } else {
      // Neutral mouth
      drawRect(ctx, x + 3, y + 8, 4, 1, colors.darkest);
    }

    // Body
    drawRect(ctx, x, y + 10, 10, 14, colors.dark);

    // Tie
    drawRect(ctx, x + 4, y + 11, 2, 6, colors.darkest);

    // Arms
    drawRect(ctx, x - 2, y + 12, 2, 8, colors.dark);
    drawRect(ctx, x + 10, y + 12, 2, 8, colors.dark);
  };

  const drawVictoryEffect = (ctx: CanvasRenderingContext2D): void => {
    const ojiX = 100;
    const ojiY = 70;

    // Stars around ojisan (4 corners)
    // Top-left star
    drawPixel(ctx, ojiX - 8, ojiY - 5, colors.darkest);
    drawPixel(ctx, ojiX - 9, ojiY - 4, colors.darkest);
    drawPixel(ctx, ojiX - 8, ojiY - 4, colors.darkest);
    drawPixel(ctx, ojiX - 7, ojiY - 4, colors.darkest);
    drawPixel(ctx, ojiX - 8, ojiY - 3, colors.darkest);

    // Top-right star
    drawPixel(ctx, ojiX + 18, ojiY - 5, colors.darkest);
    drawPixel(ctx, ojiX + 17, ojiY - 4, colors.darkest);
    drawPixel(ctx, ojiX + 18, ojiY - 4, colors.darkest);
    drawPixel(ctx, ojiX + 19, ojiY - 4, colors.darkest);
    drawPixel(ctx, ojiX + 18, ojiY - 3, colors.darkest);

    // Musical notes (♪♫)
    // Note 1 (left side)
    drawRect(ctx, ojiX - 10, ojiY + 8, 2, 6, colors.darkest);
    drawRect(ctx, ojiX - 12, ojiY + 12, 3, 3, colors.darkest);

    // Note 2 (right side)
    drawRect(ctx, ojiX + 20, ojiY + 10, 2, 6, colors.darkest);
    drawRect(ctx, ojiX + 18, ojiY + 14, 3, 3, colors.darkest);

    // Exclamation marks (!!)
    // Left exclamation
    drawRect(ctx, ojiX - 6, ojiY + 16, 2, 4, colors.darkest);
    drawPixel(ctx, ojiX - 6, ojiY + 21, colors.darkest);
    drawPixel(ctx, ojiX - 5, ojiY + 21, colors.darkest);

    // Right exclamation
    drawRect(ctx, ojiX + 14, ojiY + 16, 2, 4, colors.darkest);
    drawPixel(ctx, ojiX + 14, ojiY + 21, colors.darkest);
    drawPixel(ctx, ojiX + 15, ojiY + 21, colors.darkest);
  };

  const render = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    drawBackground(ctx);
    drawPlayer(ctx);
    drawOjisan(ctx, gameState.ojiSanMood, gameState.ojiSanPos);

    // Draw victory effect when player loses
    if (gameState.showVictoryEffect) {
      drawVictoryEffect(ctx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    // ゲーム開始後のみ自動的に最初のターンを開始
    if (gameStarted) {
      const timer = setTimeout(() => {
        nextTurn();
      }, GAME_CONFIG.TURN_DELAY);
      return () => clearTimeout(timer);
    }
  }, [gameStarted]);

  const animateOjisan = (mood: OjiSanMood): void => {
    let frames = 0;

    const animate = (): void => {
      setGameState((prev) => ({
        ...prev,
        ojiSanMood: mood,
        ojiSanPos: Math.sin(frames * 0.5) * 2,
      }));

      frames++;

      if (frames >= GAME_CONFIG.ANIMATION_FRAMES) {
        setGameState((prev) => ({
          ...prev,
          ojiSanMood: 'neutral',
          ojiSanPos: 0,
        }));
      } else {
        animationRef.current = setTimeout(animate, GAME_CONFIG.ANIMATION_DELAY);
      }
    };

    animate();
  };

  const checkGameOver = (state: GameState): boolean => {
    if (state.choshi >= GAME_CONFIG.MAX_CHOSHI) {
      endGame(false, 'LOSE... 疲労限界！');
      return true;
    }

    if (state.turn >= GAME_CONFIG.MAX_TURNS) {
      endGame(true, 'WIN! おじさんを10ターン抑え込んだ!');
      return true;
    }

    return false;
  };

  const endGame = (isWin: boolean, msg: string): void => {
    setGameState((prev) => ({
      ...prev,
      isGameOver: true,
      showVictoryEffect: !isWin, // Show effect when player loses
    }));
    setMessage(msg);
    setButtonsDisabled(true);

    if (isWin) {
      animateOjisan('happy');
    } else {
      animateOjisan('angry');
    }
  };

  const nextTurn = (): void => {
    setGameState((prev) => {
      if (prev.isGameOver) return prev;

      const newStatement =
        statements[Math.floor(Math.random() * statements.length)];
      setMessage(`おじさん: ${newStatement.text}`);
      setButtonsDisabled(false);

      return {
        ...prev,
        turn: prev.turn + 1,
        currentStatement: newStatement,
      };
    });
  };

  const handleResponse = (choice: ResponseChoice): void => {
    if (gameState.isGameOver || !gameState.currentStatement) return;

    setButtonsDisabled(true);

    const isCorrect = choice === gameState.currentStatement.correct;
    let effect = isCorrect ? responseEffects[choice] : incorrectPenalty[choice];

    // 連続失敗ボーナス計算（2回目以降で倍倍）
    let comboMultiplier = 1;
    let newConsecutiveFails = gameState.consecutiveFails;

    if (!isCorrect) {
      newConsecutiveFails++;
      // 2回目: ×2, 3回目: ×4, 4回目: ×8...
      if (newConsecutiveFails >= 2) {
        comboMultiplier = Math.pow(2, newConsecutiveFails - 1);
      }
      effect = effect * comboMultiplier;
    } else {
      // 正解でリセット
      newConsecutiveFails = 0;
    }

    const newState: GameState = {
      ...gameState,
      choshi: Math.max(
        0,
        Math.min(GAME_CONFIG.MAX_CHOSHI, gameState.choshi + effect)
      ),
      consecutiveFails: newConsecutiveFails,
    };

    setGameState(newState);

    // メッセージ生成
    let msg = '';
    if (isCorrect) {
      animateOjisan('neutral');
      msg = successMessages[choice];
    } else {
      const mood: OjiSanMood = choice === 0 ? 'happy' : 'angry';
      animateOjisan(mood);
      msg = failureMessages[choice];

      // コンボメッセージ
      if (comboMultiplier > 1) {
        msg += `\n【${newConsecutiveFails}連続失敗！×${comboMultiplier}倍ダメージ】`;
      }
    }

    setMessage(msg);

    setTimeout(() => {
      if (!checkGameOver(newState)) {
        nextTurn();
      }
    }, GAME_CONFIG.TURN_DELAY);
  };

  const handleMessageClick = (): void => {
    if (!gameStarted && !gameState.isGameOver) {
      setGameStarted(true);
    }
  };

  const restart = (): void => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
    }

    setGameState({
      choshi: 0,
      turn: 0,
      isGameOver: false,
      currentStatement: null,
      ojiSanMood: 'neutral',
      ojiSanPos: 0,
      consecutiveFails: 0,
      showVictoryEffect: false,
    });
    setMessage(
      '会議が始まります...\n\nあなたは会議に参加している会社員。\n無意識に相手を試す言動をする、\n「おためしおじさん」に対応しなければならない。\n\nおためしおじさんは確実にあなたのメンタルを削ってくる。\nおためしおじさんの対応を会議中やりきることができるか...\n\n...準備はいいですか？\n\n【クリックして開始】'
    );
    setButtonsDisabled(true);
    setGameStarted(false);
  };

  return (
    <div className="game-container">
      <div className="game-wrapper">
        <h1 className="game-title">OTAMESHI FIGHTERS: OFFICE</h1>

        <div className="status-bar">
          <div className="status-label">
            疲労度: {gameState.choshi}% {getStatusMessage(gameState.choshi)}
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${gameState.choshi}%` }}
            ></div>
          </div>
        </div>

        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            width={GAME_CONFIG.CANVAS_WIDTH}
            height={GAME_CONFIG.CANVAS_HEIGHT}
            className="game-canvas"
          />
          <div
            className="message-box"
            onClick={handleMessageClick}
            style={{ cursor: !gameStarted && !gameState.isGameOver ? 'pointer' : 'default' }}
          >
            {message}
          </div>
        </div>

        {!gameState.isGameOver ? (
          <div className="button-grid">
            <button
              onClick={() => handleResponse(0)}
              disabled={buttonsDisabled}
              className="game-button"
            >
              {gameState.currentStatement?.responses[0] || 'スルー'}
            </button>
            <button
              onClick={() => handleResponse(1)}
              disabled={buttonsDisabled}
              className="game-button"
            >
              {gameState.currentStatement?.responses[1] || '論理修正'}
            </button>
            <button
              onClick={() => handleResponse(2)}
              disabled={buttonsDisabled}
              className="game-button"
            >
              {gameState.currentStatement?.responses[2] || '共感する'}
            </button>
            <button
              onClick={() => handleResponse(3)}
              disabled={buttonsDisabled}
              className="game-button"
            >
              {gameState.currentStatement?.responses[3] || '質問返し'}
            </button>
          </div>
        ) : (
          <button onClick={restart} className="restart-button">
            リスタート
          </button>
        )}

        <div className="game-info">
          ターン: {gameState.turn}/10
          <br />
          疲労度を100%未満で10ターン耐えろ!
          <br />
          疲労度100%でLOSE
        </div>
      </div>
    </div>
  );
}

export default App;
