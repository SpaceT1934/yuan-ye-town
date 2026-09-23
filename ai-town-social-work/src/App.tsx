import Game from './components/Game.tsx';

import { ToastContainer } from 'react-toastify';
import a16zImg from '../assets/a16z.png';
import convexImg from '../assets/convex.svg';
import starImg from '../assets/star.svg';
import helpImg from '../assets/help.svg';
import chatsImg from '../assets/ui/chats.svg';
// import { UserButton } from '@clerk/clerk-react';
// import { Authenticated, Unauthenticated } from 'convex/react';
// import LoginButton from './components/buttons/LoginButton.tsx';
import { useState } from 'react';
import ReactModal from 'react-modal';
import MusicButton from './components/buttons/MusicButton.tsx';
import Button from './components/buttons/Button.tsx';
import InteractButton from './components/buttons/InteractButton.tsx';
import FreezeButton from './components/FreezeButton.tsx';
import { MAX_HUMAN_PLAYERS } from '../convex/constants.ts';
import PoweredByConvex from './components/PoweredByConvex.tsx';
import { Observatory } from './components/Observatory.tsx';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

export default function Home() {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [observatoryOpen, setObservatoryOpen] = useState(false);
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between font-body game-background">
      <PoweredByConvex />

      <ReactModal
        isOpen={helpModalOpen}
        onRequestClose={() => setHelpModalOpen(false)}
        style={modalStyles}
        contentLabel="帮助"
        ariaHideApp={false}
      >
        <div className="font-body">
          <h1 className="text-center text-6xl font-bold font-display game-title">帮助</h1>
          <p>
            欢迎来到 AI 小镇。你既可以匿名<i>观看</i>，也可以进入小镇与角色<i>互动</i>。
          </p>
          <h2 className="text-4xl mt-4">观看小镇</h2>
          <p>
            点击并拖动可以浏览小镇，滚动鼠标滚轮可以缩放。点击任意角色即可查看其对话记录。
          </p>
          <h2 className="text-4xl mt-4">参与互动</h2>
          <p>
            点击“进入小镇”后，你的角色会出现在地图上，并以脚下的高亮圆圈标识。随后便可直接与不同的 AI 角色交谈。
          </p>
          <p className="text-2xl mt-2">操作方法：</p>
          <p className="mt-4">点击地图即可移动到目标位置。</p>
          <p className="mt-4">
            要与 AI 角色交谈，请先点击角色，再点击“开始对话”。对方会向你走来，靠近后即可交谈。
            关闭对话面板或走远都可以结束对话。AI 角色也可能主动邀请你，届时消息面板会显示接受按钮。
          </p>
          <p className="mt-4">
            AI 小镇同时最多支持 {MAX_HUMAN_PLAYERS} 位真人玩家。连续五分钟没有操作时，你会自动离开小镇。
          </p>
        </div>
      </ReactModal>
      <Observatory
        isOpen={observatoryOpen}
        onClose={() => setObservatoryOpen(false)}
        worldId={worldStatus?.worldId}
      />
      {/*<div className="p-3 absolute top-0 right-0 z-10 text-2xl">
        <Authenticated>
          <UserButton afterSignOutUrl="/ai-town" />
        </Authenticated>

        <Unauthenticated>
          <LoginButton />
        </Unauthenticated>
      </div> */}

      <div className="w-full lg:h-screen min-h-screen relative isolate overflow-hidden lg:p-8 shadow-2xl flex flex-col justify-start">
        <h1 className="mx-auto text-4xl p-3 sm:text-8xl lg:text-9xl font-bold font-display leading-none tracking-wide game-title w-full text-left sm:text-center sm:w-auto">
          AI 小镇
        </h1>

        <div className="max-w-xs md:max-w-xl lg:max-w-none mx-auto my-4 text-center text-base sm:text-xl md:text-2xl text-white leading-tight shadow-solid">
          一座由 AI 角色生活、聊天和社交的虚拟小镇。
          {/* <Unauthenticated>
            <div className="my-1.5 sm:my-0" />
            Log in to join the town
            <br className="block sm:hidden" /> and the conversation!
          </Unauthenticated> */}
        </div>

        <Game />

        <footer className="justify-end bottom-0 left-0 w-full flex items-center mt-4 gap-3 p-6 flex-wrap pointer-events-none">
          <div className="flex gap-4 flex-grow pointer-events-none">
            <FreezeButton />
            <MusicButton />
            <Button href="https://github.com/a16z-infra/ai-town" imgUrl={starImg}>
              GitHub
            </Button>
            <InteractButton />
            <Button imgUrl={chatsImg} onClick={() => setObservatoryOpen(true)}>
              观察站
            </Button>
            <Button imgUrl={helpImg} onClick={() => setHelpModalOpen(true)}>
              帮助
            </Button>
          </div>
          <a href="https://a16z.com">
            <img className="w-8 h-8 pointer-events-auto" src={a16zImg} alt="a16z" />
          </a>
          <a href="https://convex.dev/c/ai-town">
            <img className="w-20 h-8 pointer-events-auto" src={convexImg} alt="Convex" />
          </a>
        </footer>
        <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
      </div>
    </main>
  );
}

const modalStyles = {
  overlay: {
    backgroundColor: 'rgb(0, 0, 0, 75%)',
    zIndex: 12,
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: '50%',

    border: '10px solid rgb(23, 20, 33)',
    borderRadius: '0',
    background: 'rgb(35, 38, 58)',
    color: 'white',
    fontFamily: '"Upheaval Pro", "sans-serif"',
  },
};
