// THROWAWAY PROTOTYPE — selected Codex-style agent conversation workspace.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type AppView = 'projects' | 'attention' | 'operations' | 'workspace';
type WorkspaceMode = 'conversation' | 'settings';
type ConfigTab = 'general' | 'agents' | 'skills' | 'mcp' | 'plugins' | 'permissions';
type StageKey = 'overview' | 'initialization' | 'requirement' | 'design' | 'cu-01-coding' | 'cu-01-testing' | 'cu-02-coding' | 'cu-02-testing' | 'cu-03-coding' | 'cu-03-testing' | 'integration' | 'acceptance';
type InspectorTab = 'summary' | 'activity' | 'evidence' | 'baselines' | 'files';
type Decision = 'waiting' | 'approved' | 'changes';
type SessionRecord = {id:string;run:string;title:string;agent:string;time:string;status:'current'|'changes'|'completed';policy:string;parent?:string;summary:string;artifact:string};
type ThreadKey = string;
type ThreadRecord = {key:ThreadKey;title:string;stage:StageKey;agent:string;state:'active'|'waiting'|'completed'|'blocked';meta:string;session:SessionRecord;parent?:ThreadKey;depth?:number;archived?:boolean};
type IconName = 'factory' | 'grid' | 'warning' | 'plus' | 'search' | 'bell' | 'check' | 'chevron' | 'doc' | 'diff' | 'shield' | 'baseline' | 'run' | 'queue' | 'close' | 'arrow' | 'folder' | 'branch' | 'paperclip';
type Project = { id:string; initials:string; name:string; template:string; stage:string; status:'active'|'review'|'initializing'; progress:number; updated:string; root:string; profile:string };

const paths: Record<IconName, React.ReactNode> = {
  factory:<><path d="M5 19V9l5 3V7l5 3V4l4 3v12Z"/><path d="M8 19v-3m4 3v-3m4 3v-3"/></>,
  grid:<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  warning:<><path d="M12 3 2.5 20h19Z"/><path d="M12 9v5m0 3h.01"/></>, plus:<path d="M12 5v14M5 12h14"/>,
  search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>, bell:<><path d="M6 9a6 6 0 0 1 12 0v5l2 2H4l2-2Z"/><path d="M10 20h4"/></>,
  check:<path d="m5 12 4 4L19 6"/>, chevron:<path d="m9 6 6 6-6 6"/>, doc:<><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></>,
  diff:<><path d="M7 3v12a4 4 0 0 0 4 4h6"/><path d="m14 16 3 3-3 3M17 3v8M14 7h6"/></>,
  shield:<><path d="M12 3 4.5 6v5c0 4.8 3 8.2 7.5 10 4.5-1.8 7.5-5.2 7.5-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
  baseline:<><path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5m-18 4 9 5 9-5"/></>,
  run:<><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></>, queue:<><path d="M5 6h14M5 12h14M5 18h9"/><circle cx="19" cy="18" r="2"/></>,
  close:<path d="m6 6 12 12M18 6 6 18"/>, arrow:<><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>, folder:<path d="M3 6h7l2 2h9v11H3z"/>, branch:<><circle cx="6" cy="5" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m2-6h5a5 5 0 0 0 5-2"/></>, paperclip:<path d="m9 12 5.8-5.8a3 3 0 0 1 4.2 4.2l-8 8a5 5 0 0 1-7.1-7.1l8.5-8.5"/>
};
function Icon({name}:{name:IconName}) { return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>; }

const initialProjects: Project[] = [
  {id:'PRJ-024',initials:'UI',name:'统一身份平台',template:'Spring Boot + Vue',stage:'总体设计审核',status:'review',progress:38,updated:'2 分钟前',root:'D:\\workspace\\identity-platform',profile:'受控开发'},
  {id:'PRJ-018',initials:'DM',name:'设备管理平台',template:'Node Service',stage:'能力单元编码与测试',status:'active',progress:72,updated:'18 分钟前',root:'D:\\workspace\\device-platform',profile:'受控开发'},
  {id:'PRJ-011',initials:'OP',name:'运营配置中心',template:'Spring Boot + Vue',stage:'系统验收',status:'active',progress:91,updated:'昨天',root:'D:\\workspace\\operations-center',profile:'严格审核'}
];

function GlobalNav({view,onNavigate}:{view:AppView;onNavigate:(view:AppView)=>void}) {
  return <aside className="global-nav"><header><span><Icon name="factory"/></span><strong>Factory</strong></header><nav>
    <button className={view==='projects'?'active':''} onClick={()=>onNavigate('projects')}><Icon name="grid"/><span>项目</span></button>
    <button className={view==='attention'?'active':''} onClick={()=>onNavigate('attention')}><Icon name="warning"/><span>待处理</span><em>3</em></button>
    <button className={view==='operations'?'active':''} onClick={()=>onNavigate('operations')}><Icon name="run"/><span>运行</span></button>
  </nav><footer><span>G</span><div><strong>操作员</strong><small>最终裁决人</small></div></footer></aside>;
}

function Topbar({view,project,onHome,onQueue}:{view:AppView;project?:Project;onHome:()=>void;onQueue:()=>void}) {
  return <header className="topbar"><div className="breadcrumbs"><button onClick={onHome}>Factory</button><b>/</b>{view==='workspace'?<><span>{project?.name}</span><b>/</b><strong>项目工作区</strong></>:<strong>{view==='attention'?'待处理':view==='operations'?'运行':'项目'}</strong>}</div><div className="top-actions"><button className="capacity-button" onClick={onQueue}><i/>执行容量 1 / 1 <em>3 个排队中</em></button><button className="command"><Icon name="search"/><span>搜索或跳转</span><kbd>⌘ K</kbd></button><button aria-label="通知"><Icon name="bell"/></button></div></header>;
}

function ProjectCard({project,onOpen}:{project:Project;onOpen:()=>void}) {
  return <button className="project-card" onClick={onOpen}><header><span className={`project-avatar ${project.status}`}>{project.initials}</span><span className={`project-state ${project.status}`}><i/>{project.status==='review'?'等待裁决':project.status==='initializing'?'初始化中':'进行中'}</span></header><h2>{project.name}</h2><p>{project.id} · {project.template}</p><div className="project-stage"><span>{project.stage}</span><strong>{project.progress}%</strong></div><div className="progress-track"><i style={{width:`${project.progress}%`}}/></div><footer><span>{project.updated}</span><span>打开工作区 <Icon name="arrow"/></span></footer></button>;
}

function ProjectsHome({projects,onOpen,onCreate}:{projects:Project[];onOpen:(projectId:string)=>void;onCreate:()=>void}) {
  return <main className="home-content"><header className="page-heading"><div><span>软件工厂</span><h1>项目</h1><p>跨项目只保留容量、待处理事项和项目入口；交付工作在项目工作区内完成。</p></div><button className="primary-action" onClick={onCreate}><Icon name="plus"/>创建项目</button></header><section className="metric-row"><div><span>活跃项目</span><strong>{projects.length}</strong><small>1 个等待人工裁决</small></div><div><span>执行容量</span><strong>1 / 1</strong><small>RUN-2048 占用执行权</small></div><div><span>待处理事项</span><strong>3</strong><small>1 个裁决 · 1 个阻塞 · 1 个需介入</small></div></section><div className="section-heading"><div><h2>最近项目</h2><p>选择项目后进入连续工作区</p></div><button>筛选 · 全部</button></div><section className="project-grid">{projects.map(project=><ProjectCard key={project.id} project={project} onOpen={()=>onOpen(project.id)}/>)}</section></main>;
}

function AttentionView({onOpen}:{onOpen:(stage:StageKey)=>void}) {
  const items:Array<[StageKey,string,string,string,string,'amber'|'red']>=[
    ['design','统一身份平台 · 总体设计','总体设计等待裁决','审核产物、差异、检查结果和证据后形成设计基线。','现在','amber'],
    ['cu-03-coding','统一身份平台 · CU-03 Coding','环境阻塞，需要人工恢复','SSO 沙箱不可用；重新检查通过后只能创建新 Run。','12 分钟','red'],
    ['cu-02-testing','统一身份平台 · CU-02 Testing','运行失联，需要介入','运行时心跳超时，系统已保留证据并停止自动重试。','28 分钟','red']
  ];
  return <main className="home-content"><header className="page-heading"><div><span>操作员收件箱</span><h1>待处理</h1><p>集中呈现裁决、阻塞和人工恢复；普通运行事件留在项目上下文中。</p></div></header><section className="attention-list">{items.map(([stage,scope,title,copy,time,tone])=><button onClick={()=>onOpen(stage)} key={title}><span className={`signal ${tone}`}><Icon name={tone==='amber'?'shield':'warning'}/></span><div><small>{scope}</small><strong>{title}</strong><p>{copy}</p></div><em>{time}</em><Icon name="chevron"/></button>)}</section></main>;
}

const operationColumns:Array<{state:string,label:string,tone:string;items:Array<[StageKey,string,string,string]>}> = [
  {state:'READY',label:'可启动',tone:'ready',items:[['cu-02-coding','RUN-2051','CU-02 · Coding','统一身份平台']]},
  {state:'RUNNING',label:'执行中',tone:'running',items:[['cu-01-testing','RUN-2052','CU-01 · Testing','统一身份平台']]},
  {state:'WAITING_FOR_HUMAN',label:'等待人工',tone:'waiting',items:[['design','RUN-2048','项目 · 总体设计','统一身份平台']]},
  {state:'BLOCKED',label:'已阻塞',tone:'blocked',items:[['cu-03-coding','RUN-2049','CU-03 · Coding','统一身份平台']]},
  {state:'COMPLETED',label:'已完成',tone:'completed',items:[['requirement','RUN-2047','项目 · Requirement','统一身份平台']]}
];
function OperationsView({onOpen}:{onOpen:(stage:StageKey)=>void}) {
  return <main className="operations-content"><header className="page-heading"><div><span>跨项目只读投影</span><h1>运行</h1><p>用于容量观察与异常定位；状态由权威 Run 推导，不能在此拖拽修改。</p></div><span className="projection-badge"><Icon name="shield"/>只读状态投影</span></header><section className="operations-board">{operationColumns.map(column=><section className="operation-column" key={column.state}><header><i className={column.tone}/><div><strong>{column.label}</strong><small>{column.state}</small></div><em>{column.items.length}</em></header>{column.items.map(([stage,run,scope,project])=><button className="operation-card" onClick={()=>onOpen(stage)} key={run}><code>{run}</code><strong>{scope}</strong><span>{project}</span><footer><small>打开权威阶段上下文</small><Icon name="arrow"/></footer></button>)}</section>)}</section><footer className="operations-note"><Icon name="warning"/><span>恢复不是继续旧会话：复检版本、模板、环境与哈希后，由操作员创建新的 Run。</span></footer></main>;
}

const treeRows: Array<{key:StageKey;label:string;meta:string;state:'done'|'active'|'locked'|'ready';depth?:number}> = [
  {key:'overview',label:'项目概览',meta:'完成 38%',state:'active'},
  {key:'initialization',label:'项目初始化',meta:'IB-024',state:'done'},
  {key:'requirement',label:'项目需求',meta:'RB-102',state:'done'},
  {key:'design',label:'总体设计',meta:'等待审核',state:'active'},
  {key:'cu-01-coding',label:'CU-01 · Coding',meta:'CB-301',state:'done',depth:1},
  {key:'cu-01-testing',label:'CU-01 · Testing',meta:'TB-301',state:'done',depth:1},
  {key:'cu-02-coding',label:'CU-02 · Coding',meta:'可启动',state:'ready',depth:1},
  {key:'cu-02-testing',label:'CU-02 · Testing',meta:'运行失联',state:'locked',depth:1},
  {key:'cu-03-coding',label:'CU-03 · Coding',meta:'环境阻塞',state:'locked',depth:1},
  {key:'cu-03-testing',label:'CU-03 · Testing',meta:'未解锁',state:'locked',depth:1},
  {key:'integration',label:'系统集成',meta:'未解锁',state:'locked'},
  {key:'acceptance',label:'系统验收',meta:'未解锁',state:'locked'}
];

const projectThreads:ThreadRecord[]=[
  {key:'main',title:'项目主线',stage:'overview',agent:'Factory',state:'active',meta:'刚刚 · 持续会话',session:{id:'THREAD-MAIN',run:'无活动运行',title:'项目主线',agent:'Factory',time:'持续',status:'current',policy:'PROJECT_TIMELINE',summary:'汇总项目目标、人工决策和各工作会话结果。',artifact:'项目时间线'}},
  {key:'design',title:'完善总体设计',stage:'design',agent:'Design Agent',state:'waiting',meta:'等待你的裁决',session:{id:'SES-04',run:'RUN-2048',title:'总体设计候选 v3',agent:'Design Agent',time:'今天 10:40',status:'current',policy:'CONTINUE_WITHIN_RUN',summary:'补齐接口约束与 ValidationContract，当前等待总体设计裁决。',artifact:'design.md · v3'}},
  {key:'design-review',title:'接口一致性审查',stage:'design',agent:'Reviewer Assistant',state:'completed',meta:'2 项发现 · 已完成',session:{id:'SES-02',run:'RUN-2031',title:'接口一致性子会话',agent:'Reviewer Assistant',time:'昨天 17:06',status:'completed',policy:'CHILD_SESSION',parent:'SES-01',summary:'独立检查能力单元依赖和接口命名，提交 2 项发现。',artifact:'interface-review.md'},parent:'design',depth:1},
  {key:'cu-01-coding',title:'实现登录能力',stage:'cu-01-coding',agent:'Coder Agent',state:'completed',meta:'14 个文件 · 已完成',session:{id:'SES-CU01-07',run:'RUN-2031',title:'实现登录能力',agent:'Coder Agent',time:'昨天 14:22',status:'completed',policy:'FRESH',summary:'完成登录能力的三个执行切片并形成代码基线。',artifact:'CB-301 · cumulative.diff'}},
  {key:'cu-01-testing',title:'登录能力测试',stage:'cu-01-testing',agent:'Tester Agent',state:'completed',meta:'31 / 32 通过',session:{id:'SES-CU01-08',run:'RUN-2032',title:'登录能力测试',agent:'Tester Agent',time:'昨天 15:08',status:'completed',policy:'FRESH',parent:'SES-CU01-07',summary:'测试义务已执行，1 项隔离由操作员接受。',artifact:'TB-301 · results.xml'},parent:'cu-01-coding',depth:1},
  {key:'audit-recovery',title:'恢复审计日志运行',stage:'cu-03-coding',agent:'Factory',state:'blocked',meta:'环境不可用',session:{id:'SES-CU03-02',run:'RUN-2049',title:'恢复审计日志运行',agent:'Factory',time:'今天 10:12',status:'current',policy:'REQUIRES_NEW_RUN',summary:'SSO 沙箱不可用，旧运行已封存并等待人工复检。',artifact:'EV-2049 · trace-771'}}
];

function threadsForProject(project:Project):ThreadRecord[] {
  if(project.id==='PRJ-024') return projectThreads.map(item=>({...item,session:{...item.session}}));
  const suffix=project.id.slice(-3);
  const activeTitle=project.status==='initializing'?'完成项目初始化':project.status==='review'?'完善总体设计':project.stage;
  return [
    {key:'main',title:'项目主线',stage:'overview',agent:'Factory',state:'active',meta:'刚刚 · 持续会话',session:{id:`THREAD-${suffix}`,run:'无活动运行',title:'项目主线',agent:'Factory',time:'持续',status:'current',policy:'PROJECT_TIMELINE',summary:`汇总${project.name}的项目目标、人工决策和工作会话结果。`,artifact:'项目时间线'}},
    {key:'design',title:activeTitle,stage:project.status==='initializing'?'initialization':'design',agent:'Primary Agent',state:project.status==='review'?'waiting':'active',meta:project.stage,session:{id:`SES-${suffix}-04`,run:`RUN-${suffix}8`,title:activeTitle,agent:'Primary Agent',time:'今天 09:36',status:'current',policy:'FRESH',summary:`正在推进${project.name}的${project.stage}。`,artifact:'当前候选产物'}},
    {key:'design-review',title:'独立结果审查',stage:'design',agent:'Reviewer Assistant',state:'completed',meta:'已完成',session:{id:`SES-${suffix}-03`,run:`RUN-${suffix}7`,title:'独立结果审查',agent:'Reviewer Assistant',time:'昨天 16:20',status:'completed',policy:'CHILD_SESSION',summary:'独立检查约束覆盖和结果一致性。',artifact:'review-findings.md'},parent:'design',depth:1},
    {key:'cu-01-coding',title:'最近完成的工作',stage:'cu-01-coding',agent:'Coder Agent',state:'completed',meta:'已封存',session:{id:`SES-${suffix}-02`,run:`RUN-${suffix}6`,title:'最近完成的工作',agent:'Coder Agent',time:'昨天 14:10',status:'completed',policy:'FRESH',summary:'工作结果已形成不可变运行记录。',artifact:'cumulative.diff'}}
  ];
}

function ConversationTree({project,threads,thread,mode,onSelect,onSettings,onNew,onExit}:{project:Project;threads:ThreadRecord[];thread:ThreadKey;mode:WorkspaceMode;onSelect:(thread:ThreadKey)=>void;onSettings:()=>void;onNew:()=>void;onExit:()=>void}) {
  const [query,setQuery]=useState('');
  const [showArchived,setShowArchived]=useState(false);
  const visible=threads.filter(item=>(showArchived?item.archived:!item.archived)&&`${item.title} ${item.agent} ${item.meta}`.toLowerCase().includes(query.toLowerCase()));
  const archivedCount=threads.filter(item=>item.archived).length;
  return <aside className="lifecycle-tree conversation-tree"><header><button className="project-switcher" onClick={onExit}><span>{project.initials}</span><div><strong>{project.name}</strong><small>{project.id} · {threads.filter(item=>!item.archived).length} 个会话</small></div><Icon name="chevron"/></button></header><button className={`project-settings-link ${mode==='settings'?'active':''}`} onClick={onSettings}><Icon name="grid"/><span><strong>项目配置</strong><small>OpenCode · 项目级</small></span><Icon name="chevron"/></button><div className="thread-toolbar"><span>{showArchived?'已归档':'会话'}</span><div><button aria-label="切换归档会话" className={showArchived?'active':''} onClick={()=>setShowArchived(!showArchived)}><Icon name="folder"/></button><button aria-label="新建会话" onClick={onNew}><Icon name="plus"/></button></div></div><label className="thread-search"><Icon name="search"/><input aria-label="搜索会话" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索会话"/></label><nav>{visible.map(item=><button className={`${mode==='conversation'&&thread===item.key?'active':''} thread-row depth-${item.depth??0}`} onClick={()=>onSelect(item.key)} key={item.key}><i className={`thread-icon ${item.state}`}>{item.parent?<Icon name="branch"/>:<Icon name={item.key==='main'?'factory':'doc'}/>}</i><span><strong>{item.title}</strong><small>{item.agent} · {item.meta}</small></span>{item.state==='waiting'&&<em>1</em>}</button>)}{visible.length===0&&<div className="thread-empty">{showArchived&&archivedCount===0?'暂无归档会话':'没有匹配的会话'}</div>}</nav><footer><div><Icon name="branch"/><span><strong>main · 工作区干净</strong><small>{project.root}</small></span></div></footer></aside>;
}

function ArtifactView() { return <article className="artifact-view"><header><div><span>design.md</span><h2>统一身份平台总体设计</h2></div><div><span>候选基线</span><strong>v3</strong></div></header><p>将项目需求基线拆分为三个可独立编码、验证和交付的能力单元，并定义跨单元接口与系统级验收场景。</p><h3>能力地图</h3>{[['CU-01','用户管理','无上游依赖','12 个需求'],['CU-02','角色权限','依赖 CU-01','6 个接口'],['CU-03','审计日志','依赖 CU-01','4 个场景']].map(([id,name,dependency,meta])=><button className="cu-row" key={id}><code>{id}</code><span><strong>{name}</strong><small>{dependency}</small></span><em>{meta}</em><Icon name="chevron"/></button>)}<footer><span>内容哈希：7ad2…91c4</span><button>打开完整产物 <Icon name="arrow"/></button></footer></article>; }
function DiffView() { return <article className="diff-view"><header><div><span>与设计 v2 比较</span><h2>新增 84 行 · 删除 27 行</h2></div><div className="diff-stat"><b>+84</b><em>−27</em></div></header><section><div className="file-head"><Icon name="doc"/><strong>design.md</strong><span>+52 −18</span></div><pre><i>@@ 能力地图</i>{'\n'}<b>+ CU-01 用户管理</b>{'\n'}<b>+ CU-02 角色权限，依赖 CU-01</b>{'\n'}<b>+ CU-03 审计日志，依赖 CU-01</b>{'\n'}{'  '}执行计划按依赖顺序派生</pre></section><section><div className="file-head"><Icon name="doc"/><strong>interface-registry.yaml</strong><span>+32 −9</span></div><pre><b>+ identity.user.v1</b>{'\n'}<b>+ identity.role.v1</b>{'\n'}<b>+ audit.event.v1</b></pre></section></article>; }

function HumanGate({decision,setDecision}:{decision:Decision;setDecision:(value:Decision)=>void}) {
  if(decision!=='waiting') return <section className={`inline-gate gate-result ${decision}`}><span className="outcome-icon"><Icon name={decision==='approved'?'check':'arrow'}/></span><div><small>审核记录 · RR-882</small><h3>{decision==='approved'?'设计基线 v3 已批准':'已退回设计智能体修订'}</h3><p>{decision==='approved'?'执行计划现在可以从冻结的设计基线派生。':'当前产物、差异与证据均已保留。'}</p></div><button onClick={()=>setDecision('waiting')}>重新打开</button></section>;
  return <section className="inline-gate"><div className="gate-title"><span><Icon name="shield"/></span><div><small>人工裁决 · 期望阶段版本 v17</small><h3>批准总体设计？</h3></div></div><p>批准后形成不可原地修改的设计基线，并绑定当前产物哈希、证据集与 ReviewRecord。</p><div className="gate-facts"><span>审核人 <b>操作员 G</b></span><span>执行人 <b>Design Agent</b></span><span>审核策略 <b>single_operator 已启用</b></span><span>未决事项 <b className="warn-text">SSO 沙箱</b></span></div><textarea aria-label="裁决说明" placeholder="必填：记录批准依据、附加条件或修改要求…"/><div className="inline-actions"><button onClick={()=>setDecision('changes')}>退回修订</button><button className="approve" onClick={()=>setDecision('approved')}>批准并生成 ReviewRecord <Icon name="arrow"/></button></div></section>;
}

function ReviewPacket(){return <section className="review-packet"><header><div><span>正式审核材料</span><h3>Design Gate · v17</h3></div><strong>7 项已绑定</strong></header><div className="packet-grid">{[
  ['候选产物','design.md · 7ad2…91c4'],['上版差异','+84 / −27'],['Handoff','HO-2048 · 已生成'],['确定性检查','18 / 18 通过'],['环境绑定','SSO 沙箱 · 警告'],['未决问题','1 项非阻塞'],['Evidence','EV-2048 · 4 条']
].map(([name,value])=><button key={name}><span>{name}</span><strong>{value}</strong><Icon name="chevron"/></button>)}</div></section>}

const stageCopy: Record<StageKey,[string,string,string]> = {
  overview:['项目概览','统一身份平台','当前唯一需要处理的事项是总体设计裁决；后续执行计划尚未生效。'],
  initialization:['项目初始化 · 已批准','项目初始化','模板、工作目录和权威检查已固定为初始化基线。'],
  requirement:['项目需求 · 已批准','项目需求','12 个需求项已批准并形成唯一需求基线。'],
  design:['项目总体设计 · 等待审核','确认总体设计','审核候选产物、差异与证据，然后形成正式设计基线。'],
  'cu-01-coding':['CU-01 · 已批准','Coding','累计实际 Diff 与权威检查已形成 CodeBaseline。'],
  'cu-01-testing':['CU-01 · 已批准','Testing','测试义务、结果与运行轨迹已形成 TestBaseline。'],
  'cu-02-coding':['CU-02 · 可启动','Coding','依赖基线有效，等待执行容量后创建新的 Run。'],
  'cu-02-testing':['CU-02 · 需要介入','Testing','运行时心跳丢失，系统已保留证据并停止自动重试。'],
  'cu-03-coding':['CU-03 · On Hold','Coding','SSO 沙箱阻塞真实认证切片，需要人工复检后创建新 Run。'],
  'cu-03-testing':['CU-03 · 未解锁','Testing','只有有效 CodeBaseline 后才可创建测试运行。'],
  integration:['项目 · 未解锁','系统集成','所有纳入发布范围的 CU 形成有效测试基线后启动跨单元验证。'],
  acceptance:['项目 · 未解锁','系统验收','发布范围内全部能力单元形成有效测试基线后解锁。']
};

function OverviewPanel({onDesign}:{onDesign:()=>void}) { return <div className="overview-panel"><section className="overview-hero"><div><span>当前裁决</span><h2>总体设计等待人工裁决</h2><p>需求已批准，设计智能体已提交候选 v3。批准前不会生成执行计划。</p></div><button className="primary-action" onClick={onDesign}>打开设计裁决 <Icon name="arrow"/></button></section><section className="overview-stats"><div><span>项目进度</span><strong>38%</strong><small>已完成 2 / 5 个项目阶段</small></div><div><span>能力单元</span><strong>3</strong><small>1 个已交付 · 2 个等待中</small></div><div><span>待处理信号</span><strong>1</strong><small>SSO 沙箱不可用</small></div></section><section className="stage-timeline"><header><h3>生命周期</h3><span>按领域状态推进，不支持拖拽越过裁决</span></header>{[['项目初始化','已批准','IB-024'],['项目需求','已批准','RB-102'],['总体设计','等待审核','RUN-2048'],['能力单元执行','未解锁','3 个能力单元'],['系统验收','未解锁','项目范围']].map(([name,status,meta],index)=><div key={name}><i className={index<2?'done':index===2?'active':'locked'}>{index<2?<Icon name="check"/>:index+1}</i><span><strong>{name}</strong><small>{meta}</small></span><em>{status}</em></div>)}</section></div>; }

const stageFacts:Record<Exclude<StageKey,'overview'|'design'>,Array<[string,string]>>={
  initialization:[['模板绑定','Spring Boot + React · v1.4.2 · a91c…70d2'],['初始化参数','6 项 · 已冻结'],['Git 初始版本','91ec…3ab0'],['权威检查','编译 / 测试 / 启动 / 停止全部通过']],
  requirement:[['原始输入','需求说明 + 3 个附件'],['需求产物','requirements.md · 12 项'],['候选能力单元','3 个'],['正式基线','RB-102 · 已批准']],
  'cu-01-coding':[['累计 Diff','14 文件 · +684 / −92'],['执行切片','SL-11 / SL-12 / SL-13'],['权威检查','lint / build / unit 全部通过'],['代码基线','CB-301 · 91ec…3ab0']],
  'cu-01-testing':[['测试义务','32 / 32 已覆盖'],['测试结果','31 通过 · 1 已接受隔离'],['环境绑定','test-env-04 · image 8c31…'],['测试基线','TB-301 · 已批准']],
  'cu-02-coding':[['输入基线','DB-203 + CU-01 CB-301'],['执行计划','4 个增量切片'],['容量状态','READY · 队列第 1 位'],['下一步','创建全新 Run']],
  'cu-02-testing':[['失联运行','RUN-2052 · 心跳超时'],['最后证据','trace-771 · 10:12:08'],['自动处置','停止重试并封存现场'],['人工动作','确认运行时后创建新 Run']],
  'cu-03-coding':[['OnHold 原因','ENVIRONMENT_UNAVAILABLE'],['失效运行','RUN-2049 · 不可恢复'],['环境绑定','sso-sandbox · unavailable'],['恢复规则','复检通过后创建新 Run']],
  'cu-03-testing':[['前置条件','CU-03 CodeBaseline'],['当前状态','LOCKED'],['测试义务','尚未从设计基线派生'],['下一步','等待 Coding Gate']],
  integration:[['纳入范围','CU-01 / CU-02 / CU-03'],['基线条件','3 个有效 TestBaseline'],['跨单元断言','身份、权限、审计链路'],['当前状态','2 个前置条件未满足']],
  acceptance:[['验收范围','Project Release Candidate'],['正式输入','Integration Evidence + CU Baselines'],['人工裁决','System Acceptance Gate'],['当前状态','等待系统集成完成']]
};
function StageSummary({stage}:{stage:StageKey}) { const [eyebrow,title,copy]=stageCopy[stage]; const facts=stageFacts[stage as keyof typeof stageFacts]??[]; return <section className="stage-summary-card"><span>{eyebrow}</span><h2>{title}</h2><p>{copy}</p><dl>{facts.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>{stage==='cu-03-coding'&&<RecoveryPanel/>}</section>; }

function RecoveryPanel(){const [checked,setChecked]=useState(false);const [created,setCreated]=useState(false);return <div className="recovery-panel"><header><Icon name="warning"/><div><strong>人工恢复</strong><small>旧运行保持终态，不续接旧会话</small></div></header><ol><li className={checked?'done':''}>重新检查 baseline / revision / template / env / hash</li><li className={created?'done':''}>操作员确认后创建新的 Run</li></ol><div>{!checked?<button onClick={()=>setChecked(true)}>重新检查环境</button>:!created?<button className="approve" onClick={()=>setCreated(true)}>创建新 Run</button>:<strong>RUN-2054 已创建 · READY</strong>}</div></div>}

const designSessions:SessionRecord[]=[
  {id:'SES-04',run:'RUN-2048',title:'总体设计候选 v3',agent:'Design Agent',time:'今天 10:40',status:'current',policy:'CONTINUE_WITHIN_RUN',summary:'补齐接口约束与 ValidationContract，当前等待总体设计裁决。',artifact:'design.md · v3'},
  {id:'SES-03',run:'RUN-2039',title:'总体设计候选 v2',agent:'Design Agent',time:'今天 09:18',status:'changes',policy:'REBUILT_FROM_BASELINE',summary:'操作员要求补充审计事件契约，并退回修订。',artifact:'design.md · v2'},
  {id:'SES-02',run:'RUN-2031',title:'接口一致性子会话',agent:'Reviewer Assistant',time:'昨天 17:06',status:'completed',policy:'CHILD_SESSION',parent:'SES-01',summary:'独立检查能力单元依赖和接口命名，提交 2 项发现。',artifact:'interface-review.md'},
  {id:'SES-01',run:'RUN-2031',title:'总体设计候选 v1',agent:'Design Agent',time:'昨天 16:42',status:'completed',policy:'FRESH',summary:'从需求基线 RB-102 创建首版总体设计与能力地图。',artifact:'design.md · v1'}
];
function sessionsForStage(stage:StageKey):SessionRecord[]{
  if(stage==='design')return designSessions;
  const run=inspectorData(stage).run;
  return [{id:`SES-${stage.toUpperCase()}`,run,title:stageCopy[stage][1],agent:'Stage Agent',time:'当前阶段',status:'current',policy:'FRESH',summary:stageCopy[stage][2],artifact:'阶段产物'}];
}

function SessionHistoryPanel({stage,sessions,selected,onSelect,onClose}:{stage:StageKey;sessions:SessionRecord[];selected:string;onSelect:(id:string)=>void;onClose:()=>void}){
  return <><button className="session-panel-scrim" aria-label="关闭会话记录" onClick={onClose}/><aside className="session-history-panel" aria-label="阶段会话记录"><header><div><span>Stage Thread</span><h2>{stageCopy[stage][1]} · 会话记录</h2><p>{sessions.length} 个 Host Session，按 Run 边界连续呈现</p></div><button aria-label="关闭会话记录" onClick={onClose}><Icon name="close"/></button></header><div className="session-model-note"><Icon name="shield"/><p><b>阶段时间线不是单个模型会话。</b>新 Run 使用新 Session；历史记录只读，正式上下文仍由 Baseline、Handoff 与 Evidence 重建。</p></div><div className="session-list">{sessions.map((session,index)=><button className={`${selected===session.id?'active':''} ${session.status}`} onClick={()=>{onSelect(session.id);onClose()}} key={session.id}>{index>0&&sessions[index-1].run!==session.run&&<span className="run-divider">新 Run</span>}<i/><div><header><code>{session.run}</code><em>{session.status==='current'?'当前':session.status==='changes'?'已退回':'已完成'}</em></header><strong>{session.title}</strong><small>{session.id} · {session.agent}{session.parent?` · 子会话 / ${session.parent}`:''}</small><p>{session.summary}</p><footer><span>{session.time}</span><span>{session.policy}</span></footer></div><Icon name="chevron"/></button>)}</div><footer><span>原型数据</span><p>生产实现由 StageConversation Projection 查询，不读取浏览器本地状态作为业务事实。</p></footer></aside></>;
}

function ConversationHeader({project,threads,thread,onRename,onArchive}:{project:Project;threads:ThreadRecord[];thread:ThreadRecord;onRename:()=>void;onArchive:()=>void}) {
  const parent=thread.parent?threads.find(item=>item.key===thread.parent):undefined;
  return <header className="conversation-header"><div><span>{parent?`${parent.title} / 子 Agent 会话`:`${project.name} / 工作会话`}</span><h1>{thread.title}</h1></div><div className="conversation-header-actions">{thread.key!=='main'&&<><button onClick={onRename}>重命名</button><button onClick={onArchive}>归档</button></>}<div className={`conversation-status ${thread.state}`}><i/><span>{thread.state==='waiting'?'等待裁决':thread.state==='completed'?'已完成':thread.state==='blocked'?'需要介入':'进行中'}</span><small>{thread.agent}</small></div></div></header>;
}

function AssistantMessage({stage}:{stage:StageKey}) {
  return <article className="agent-message"><span className="agent-avatar"><Icon name="factory"/></span><div><header><strong>Factory</strong><small>设计智能体 · 刚刚</small></header><p>{stage==='design'?'我已读取需求基线 RB-102，并完成总体设计候选 v3。需求覆盖与接口一致性检查通过；SSO 沙箱不可用，但不影响当前设计结构裁决。':stageCopy[stage][2]}</p>{stage==='overview'&&<p>当前建议先完成总体设计裁决，再生成能力单元执行计划。</p>}</div></article>;
}

function ExecutionTrace({compact=false}:{compact?:boolean}) {
  return <details className={`execution-trace ${compact?'compact':''}`} open><summary><span><Icon name="run"/></span><div><strong>执行过程</strong><small>RUN-2048 · 5 个步骤 · 已暂停等待裁决</small></div><em>4 / 5</em><Icon name="chevron"/></summary><div className="trace-events">{[
    ['10:40:51','读取需求基线','RB-102','done'],
    ['10:41:03','生成总体设计候选','design.md · v3','done'],
    ['10:41:09','验证需求与接口覆盖','18 / 18 项通过','done'],
    ['10:41:14','检查外部环境','SSO 沙箱不可用','warn'],
    ['10:41:16','等待人工裁决','自动执行已暂停','active']
  ].map(([time,label,meta,state])=><div className={state} key={time}><i>{state==='done'?<Icon name="check"/>:null}</i><time>{time}</time><span><strong>{label}</strong><small>{meta}</small></span></div>)}</div></details>;
}

function ArtifactMessage({full=false}:{full?:boolean}) {
  if(full) return <section className="artifact-canvas"><ArtifactView/></section>;
  return <button className="artifact-message"><span><Icon name="doc"/></span><div><small>候选产物 · 已修改</small><strong>design.md</strong><p>总体设计 v3 · 3 个能力单元 · 12 项需求</p></div><em>+84 −27</em><Icon name="chevron"/></button>;
}

type ComposerProps = {thread:ThreadRecord;onSend:(message:string)=>void};
function AgentComposer({thread,onSend}:ComposerProps) {
  const [message,setMessage]=useState('');
  const [attachments,setAttachments]=useState<string[]>([]);
  const fileInput=useRef<HTMLInputElement>(null);
  const send=()=>{if(!message.trim()&&!attachments.length)return;const content=[message.trim(),attachments.length?`附件：${attachments.join('、')}`:''].filter(Boolean).join(' · ');onSend(content);setMessage('');setAttachments([])};
  return <div className="agent-composer-wrap"><section className="agent-composer">{attachments.length>0&&<div className="attachment-row">{attachments.map(file=><span key={file}><Icon name="doc"/>{file}<button aria-label={`移除附件 ${file}`} onClick={()=>setAttachments(attachments.filter(name=>name!==file))}><Icon name="close"/></button></span>)}</div>}<textarea aria-label="与 Factory 对话" value={message} onChange={event=>setMessage(event.target.value)} placeholder={`向“${thread.title}”发送消息、补充上下文或上传资料…`} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}}}/><footer><div><input ref={fileInput} type="file" multiple hidden aria-label="选择要上传的文件" onChange={event=>setAttachments(Array.from(event.target.files??[]).map(file=>file.name))}/><button aria-label="上传文件" onClick={()=>fileInput.current?.click()}><Icon name="paperclip"/>上传文件</button><span>发送到当前工作会话</span></div><button className="send-message" aria-label="发送消息" disabled={!message.trim()&&!attachments.length} onClick={send}><Icon name="arrow"/></button></footer></section><small className="composer-policy">工作会话可持续 · 正式批准、退回和接管仍通过 Gate 完成</small></div>;
}

function MainlineConversation({project,threads,messages,onOpen}:{project:Project;threads:ThreadRecord[];messages:string[];onOpen:(thread:ThreadKey)=>void}){
  const active=threads.find(item=>item.key==='design'); const completed=threads.find(item=>item.key==='cu-01-coding');
  return <div className="conversation-scroll stream-layout mainline-stream"><article className="user-message"><span>你</span><p>基于当前方案推进{project.name}，并在关键阶段交给我裁决。</p></article><article className="agent-message"><span className="agent-avatar"><Icon name="factory"/></span><div><header><strong>Factory</strong><small>项目主线 · 刚刚</small></header><p>{project.name}当前处于“{project.stage}”。重要运行结果、人工决策和子 Agent 结果会持续汇总到这条主线。</p></div></article>{active&&<button className={`mainline-event ${active.state}`} onClick={()=>onOpen(active.key)}><span><Icon name={active.state==='waiting'?'shield':'run'}/></span><div><small>{active.state==='waiting'?'等待人工裁决':'当前工作会话'}</small><strong>{active.title}</strong><p>{active.agent} · {active.meta}</p></div><Icon name="chevron"/></button>}<section className="mainline-divider"><span>最近</span></section>{completed&&<button className="mainline-event completed" onClick={()=>onOpen(completed.key)}><span><Icon name="check"/></span><div><small>工作会话已完成</small><strong>{completed.title}</strong><p>{completed.session.run} · {completed.meta}</p></div><Icon name="chevron"/></button>}{messages.map((message,index)=><article className="user-message" key={`${message}-${index}`}><span>你</span><p>{message}</p></article>)}</div>;
}

function EmptyConversation({project}:{project:Project}){
  return <div className="conversation-scroll empty-conversation"><span><Icon name="factory"/></span><h2>开始新的工作会话</h2><p>围绕 {project.name} 提问、补充上下文或上传资料。需要执行时，Factory 会创建新的 Run，并将结果投影到右侧项目状态。</p><small>此会话尚未关联 Run 或子 Agent</small></div>;
}

function ConversationStream({stage,decision,setDecision,messages,onDesign}:{stage:StageKey;decision:Decision;setDecision:(value:Decision)=>void;messages:string[];onDesign:()=>void}) {
  return <div className="conversation-scroll stream-layout"><AssistantMessage stage={stage}/>{stage==='design'&&<><ExecutionTrace/><ArtifactMessage/><ReviewPacket/><HumanGate decision={decision} setDecision={setDecision}/></>}{stage==='overview'&&<OverviewPanel onDesign={onDesign}/>} {stage!=='design'&&stage!=='overview'&&<StageSummary stage={stage}/>} {messages.map((message,index)=><article className="user-message" key={`${message}-${index}`}><span>你</span><p>{message}</p></article>)}</div>;
}

function HistoricalConversation({session,onReturn}:{session:SessionRecord;onReturn:()=>void}){
  const changed=session.status==='changes';
  return <div className="conversation-scroll stream-layout historical-stream"><section className="history-banner"><span><Icon name="shield"/></span><div><small>不可变历史记录</small><strong>{session.run} / {session.id}</strong><p>该 Host Session 已结束；消息、工具过程与产物仅供审计，不能继续输入或重新执行 Gate。</p></div><button onClick={onReturn}>返回当前会话 <Icon name="arrow"/></button></section><div className="run-boundary"><span>{session.run} 创建</span><small>{session.policy} · {session.time}</small></div><article className="user-message historic-user"><span>你</span><p>{changed?'请补充审计事件的数据契约、失败语义和跨 CU 一致性检查，再提交新版总体设计。':'请基于需求基线完成总体设计，并明确能力单元、接口依赖和验收边界。'}</p></article><article className="agent-message"><span className="agent-avatar"><Icon name="factory"/></span><div><header><strong>{session.agent}</strong><small>{session.id} · 已结束</small></header><p>{session.summary}</p></div></article><section className="historic-run-card"><header><span><Icon name="run"/></span><div><strong>执行摘要</strong><small>Host Session 事件已脱敏并按 sequence 固定</small></div><em>{changed?'CHANGES_REQUESTED':'COMPLETED'}</em></header>{[['读取权威基线','RB-102 · hash 已校验'],['装配运行上下文',session.policy],['生成阶段产物',session.artifact],['封存外显轨迹','MESSAGE_PART · TOOL_COMPLETED']].map(([name,meta],index)=><div key={name}><i><Icon name="check"/></i><span><strong>{name}</strong><small>{meta}</small></span><time>0{index+1}</time></div>)}</section><button className="artifact-message history-artifact"><span><Icon name="doc"/></span><div><small>历史产物 · 只读</small><strong>{session.artifact}</strong><p>绑定 {session.run} / {session.id}</p></div><em>已封存</em><Icon name="chevron"/></button><section className={`history-outcome ${changed?'changes':'completed'}`}><Icon name={changed?'arrow':'check'}/><div><small>{changed?'ReviewRecord · RR-871':'RunResult · HRS-2031'}</small><strong>{changed?'操作员已退回修订':'会话已完成并封存'}</strong><p>{changed?'后续 RUN-2048 使用新 Session 从正式基线和反馈重建上下文。':'历史结果不自动成为当前阶段权威状态。'}</p></div></section><div className="run-boundary end"><span>{session.run} 结束</span><small>历史会话只读</small></div></div>;
}

function ReadOnlyComposer({onReturn}:{onReturn:()=>void}){return <div className="agent-composer-wrap"><section className="readonly-composer"><Icon name="shield"/><div><strong>正在查看历史会话</strong><small>旧 Session 不可续接；返回当前会话后才能提问或上传文件。</small></div><button onClick={onReturn}>返回当前会话</button></section></div>}

function WorkSurface({project,threads,thread,decision,setDecision,onSend,onRename,onArchive,messages,onThreadSelect}:{project:Project;threads:ThreadRecord[];thread:ThreadRecord;decision:Decision;setDecision:(value:Decision)=>void;onSend:(message:string)=>void;onRename:()=>void;onArchive:()=>void;messages:string[];onThreadSelect:(thread:ThreadKey)=>void}) {
  const viewingHistory=thread.session.status!=='current';
  return <main className="agent-workspace"><ConversationHeader project={project} threads={threads} thread={thread} onRename={onRename} onArchive={onArchive}/>{thread.key==='main'?<MainlineConversation project={project} threads={threads} messages={messages} onOpen={onThreadSelect}/>:thread.session.policy==='USER_CREATED'?<EmptyConversation project={project}/>:viewingHistory?<HistoricalConversation session={thread.session} onReturn={()=>onThreadSelect('main')}/>:<ConversationStream stage={thread.stage} decision={decision} setDecision={setDecision} messages={messages} onDesign={()=>onThreadSelect('design')}/>} {viewingHistory?<ReadOnlyComposer onReturn={()=>onThreadSelect('main')}/>:<AgentComposer thread={thread} onSend={onSend}/>}</main>;
}

function ColumnResizer({label,onDrag,onNudge}:{label:string;onDrag:(delta:number)=>void;onNudge:(delta:number)=>void}) {
  const startDrag=(event:React.PointerEvent<HTMLDivElement>)=>{event.preventDefault();const startX=event.clientX;document.body.classList.add('resizing-columns');const move=(moveEvent:PointerEvent)=>onDrag(moveEvent.clientX-startX);const stop=()=>{document.body.classList.remove('resizing-columns');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop)};
  return <div className={`column-resizer ${label.includes('会话')?'left-resizer':'right-resizer'}`} role="separator" aria-label={label} aria-orientation="vertical" tabIndex={0} onPointerDown={startDrag} onKeyDown={event=>{if(event.key==='ArrowLeft')onNudge(-12);if(event.key==='ArrowRight')onNudge(12)}}><i/></div>;
}

function inspectorData(stage:StageKey){
  const cu=stage.match(/cu-(\d\d)/)?.[0]?.toUpperCase();
  const run:Partial<Record<StageKey,string>>={design:'RUN-2048','cu-01-coding':'RUN-2031','cu-01-testing':'RUN-2032','cu-02-coding':'尚未创建','cu-02-testing':'RUN-2052','cu-03-coding':'RUN-2049'};
  const evidence=stage==='design'?[['需求覆盖','12 / 12','pass'],['接口一致性','6 / 6','pass'],['Handoff','HO-2048','pass'],['环境依赖','1 个警告','warn']]:stage.includes('testing')?[['测试义务','32 项','pass'],['执行轨迹','trace-771','pass'],['环境指纹','image 8c31…','pass']]:[['版本绑定','91ec…3ab0','pass'],['权威检查','已记录','pass'],['执行轨迹','append-only','pass']];
  const baselines=stage.startsWith('cu-')?[['设计基线','DB-203','已批准'],['代码基线',stage.includes('01')?'CB-301':'尚未形成',stage.includes('01')?'有效':'待定'],['测试基线',stage.includes('01')?'TB-301':'尚未形成',stage.includes('01')?'有效':'待定']]:[['初始化基线','IB-024','已批准'],['需求基线','RB-102','已批准'],['设计基线','DB-203 / 候选 v3',stage==='design'?'等待审核':'当前有效']];
  const files=stage==='initialization'?[['template.lock','已冻结'],['init-report.json','已封存'],['readiness.log','检查通过']]:stage.includes('testing')?[['test-obligations.yaml','已绑定'],['results.xml','已封存'],['trace.jsonl','只追加']]:stage.startsWith('cu-')?[['slice-plan.yaml','已绑定'],['cumulative.diff','累计实际差异'],['handoff.json','已生成']]:[['design.md','候选 v3'],['interface-registry.yaml','已修改'],['validation-contract.yaml','已绑定'],['evidence/EV-2048','已封存']];
  return {scope:cu??'Project',run:run[stage]??(stage==='initialization'?'RUN-2045':stage==='requirement'?'RUN-2047':'无活动运行'),status:treeRows.find(row=>row.key===stage)?.meta??'项目状态',evidence,baselines,files};
}
function LifecycleProjection({project,stage}:{project:Project;stage:StageKey}){
  const rows:Array<[StageKey,string,string,'done'|'active'|'locked']>=[['initialization','项目初始化','已批准','done'],['requirement','项目需求','已批准','done'],['design','总体设计','等待裁决','active'],['cu-01-coding','能力单元执行','1 / 3 完成','active'],['integration','系统集成','未解锁','locked'],['acceptance','系统验收','未解锁','locked']];
  return <section className="lifecycle-projection"><header><span>项目生命周期</span><strong>{project.progress}%</strong></header><div className="lifecycle-progress"><i style={{width:`${project.progress}%`}}/></div>{rows.map(([key,name,status,state])=><div className={`${state} ${stage===key?'selected':''}`} key={key}><i>{state==='done'?<Icon name="check"/>:null}</i><span><strong>{name}</strong><small>{status}</small></span></div>)}</section>;
}

function Inspector({project,tab,setTab,threads,thread}:{project:Project;tab:InspectorTab;setTab:(tab:InspectorTab)=>void;threads:ThreadRecord[];thread:ThreadRecord}) {
  const {stage,session}=thread; const tabs: Array<[InspectorTab,string]> = [['summary','生命周期'],['activity','动态'],['evidence','证据'],['baselines','基线'],['files','文件']]; const data=inspectorData(stage);
  const historical=session.status!=='current';
  return <aside className="inspector"><header><span>项目交付状态</span><strong>{thread.title}</strong></header><nav>{tabs.map(([key,label])=><button className={tab===key?'active':''} onClick={()=>setTab(key)} key={key}>{label}{key==='activity'&&<em>5</em>}{key==='evidence'&&<em>{data.evidence.length}</em>}</button>)}</nav><div className="inspector-body">{tab==='summary'&&<div className="summary-tab"><LifecycleProjection project={project} stage={stage}/><section className={`thread-context-card ${historical?'historical-context':''}`}><span>当前会话范围</span><strong>{thread.key==='main'||stage==='overview'?project.name:stageCopy[stage][1]}</strong><small>{thread.parent?`子 Agent · 父会话：${threads.find(item=>item.key===thread.parent)?.title}`:`${thread.agent} · ${thread.meta}`}</small></section><dl><div><dt>关联运行</dt><dd>{session.run}</dd></div><div><dt>Host Session</dt><dd>{session.id}</dd></div><div><dt>作用范围</dt><dd>{data.scope}</dd></div><div><dt>Git 版本</dt><dd>91ec…3ab0</dd></div></dl>{historical?<aside className="history-warning"><Icon name="shield"/><p>该记录不可继续执行，也不会直接注入新 Run 的模型上下文。</p></aside>:(stage==='design'||stage==='cu-03-coding')&&<aside><Icon name="warning"/><p>{stage==='design'?'SSO 沙箱为非阻塞警告；仍需在 ReviewRecord 中说明。':'环境不可用；禁止续接旧运行或自动重试。'}</p></aside>}</div>}{tab==='activity'&&<div className="activity-tab">{[['10:40:51',`读取 ${data.scope} 输入基线`],['10:41:03','创建候选产物与 Handoff'],['10:41:09','运行确定性检查'],['10:41:14','封存 Evidence 与环境绑定'],['10:41:16',`状态变更：${historical?'会话已封存':data.status}`]].map(([time,event],index)=><div key={time}><i className={index===4?'active':''}/><span><small>{time}</small><strong>{event}</strong></span></div>)}</div>}{tab==='evidence'&&<div className="inspector-list">{data.evidence.map(([name,meta,state])=><button key={name}><span className={state}><Icon name={state==='pass'?'check':'warning'}/></span><div><strong>{name}</strong><small>{meta}</small></div><Icon name="chevron"/></button>)}</div>}{tab==='baselines'&&<div className="inspector-list">{data.baselines.map(([name,id,status])=><button key={name}><span className="baseline"><Icon name="baseline"/></span><div><strong>{name}</strong><small>{id} · {status}</small></div><Icon name="chevron"/></button>)}</div>}{tab==='files'&&<div className="inspector-list files">{data.files.map(([name,state])=><button key={name}><Icon name={name.startsWith('evidence')?'shield':'doc'}/><div><strong>{name}</strong><small>{state}</small></div></button>)}</div>}</div><footer><Icon name="shield"/><span>生命周期由权威领域状态计算，会话不能直接修改</span></footer></aside>;
}

const configCollections:Record<Exclude<ConfigTab,'general'>,Array<[string,string,string]>>={
  agents:[['Primary Agent','主会话 · openai/gpt-5','项目配置'],['Design Agent','总体设计与接口约束','模板绑定'],['Reviewer Assistant','只读子 Agent','项目配置']],
  skills:[['karpathy-guidelines','降低编码与重构错误','项目 .agents/skills'],['project-release','生成发布说明与版本检查','项目 .opencode/skills'],['architecture-review','架构一致性审查','模板继承']],
  mcp:[['github','远程 · 已连接','环境凭据'],['postgres-tools','本地 · stdio','项目配置'],['context7','远程 · 已停用','项目配置']],
  plugins:[['sdlc-factory-host','本地插件 · 版本已固定','.opencode/plugins'],['opencode-wakatime','npm · 可选','opencode.json'],['environment-guard','本地插件 · 已启用','.opencode/plugins']],
  permissions:[['文件编辑','允许 · 项目工作区内','项目策略'],['Shell 命令','需要确认','受控开发'],['子 Agent','允许指定 Agent','项目策略'],['外部目录','拒绝','安全默认值']]
};

function ProjectSettings({project}:{project:Project}){
  const [tab,setTab]=useState<ConfigTab>('general');
  const [enabled,setEnabled]=useState<Record<string,boolean>>({'Primary Agent':true,'Design Agent':true,'Reviewer Assistant':true,'karpathy-guidelines':true,'project-release':true,'architecture-review':true,github:true,'postgres-tools':true,context7:false,'sdlc-factory-host':true,'opencode-wakatime':false,'environment-guard':true});
  const tabs:Array<[ConfigTab,string]>=[['general','基础'],['agents','Agent'],['skills','Skills'],['mcp','MCP'],['plugins','Plugins'],['permissions','权限']];
  return <main className="agent-workspace settings-workspace"><header className="conversation-header"><div><span>{project.name} / 项目级运行配置</span><h1>OpenCode 配置</h1></div><div className="config-source"><i/><span>有效配置</span><small>项目覆盖已加载</small></div></header><div className="settings-body"><nav className="settings-tabs">{tabs.map(([key,label])=><button className={tab===key?'active':''} onClick={()=>setTab(key)} key={key}>{label}</button>)}</nav>{tab==='general'?<div className="general-settings"><section className="settings-intro"><span>项目默认值</span><h2>{project.profile}</h2><p>由项目模板生成，可在创建新 Run 前修改。运行开始后固定为不可变配置快照。</p></section><section className="setting-fields"><label>项目目录<strong>{project.root}</strong><small>OpenCode 从该 Git 工作树加载项目配置</small></label><label>OpenCode 版本<strong>固定版本 · 兼容性已验证</strong><small>具体 CLI / SDK 版本由 Host Adapter 管理</small></label><label>默认模型<strong>openai/gpt-5</strong><small>Agent 可在授权范围内覆盖</small></label><label>配置文件<strong>opencode.json</strong><small>项目设置优先于用户全局默认值</small></label></section></div>:<div className="config-list"><header><div><span>{tabs.find(item=>item[0]===tab)?.[1]}</span><h2>{configCollections[tab].length} 个项目条目</h2></div><button><Icon name="plus"/>添加</button></header>{configCollections[tab].map(([name,meta,source])=><section key={name}><span className="config-item-icon"><Icon name={tab==='mcp'?'run':tab==='skills'?'doc':tab==='plugins'?'grid':tab==='permissions'?'shield':'factory'}/></span><div><strong>{name}</strong><small>{meta}</small></div><em>{source}</em>{tab!=='permissions'&&<button role="switch" aria-checked={enabled[name]??true} className={`config-toggle ${(enabled[name]??true)?'on':''}`} onClick={()=>setEnabled(value=>({...value,[name]:!(value[name]??true)}))}><i/></button>}</section>)}</div>}</div></main>;
}

function ConfigInspector({project}:{project:Project}){
  return <aside className="inspector config-inspector"><header><span>配置状态</span><strong>{project.name}</strong></header><div className="inspector-body"><div className="config-health"><section><span><Icon name="check"/></span><div><strong>配置校验通过</strong><small>Schema 与固定 Host 版本兼容</small></div></section><dl><div><dt>项目配置</dt><dd>opencode.json</dd></div><div><dt>Agent</dt><dd>3 个</dd></div><div><dt>Skills</dt><dd>3 个</dd></div><div><dt>MCP</dt><dd>2 / 3 已启用</dd></div><div><dt>Plugins</dt><dd>2 / 3 已启用</dd></div><div><dt>待重载</dt><dd>无</dd></div></dl><aside><Icon name="shield"/><p>密钥和 OAuth Token 不写入项目文件，只保存引用和连接状态。</p></aside><section className="config-snapshot"><span>下次 Run 将绑定</span><strong>CONFIG-7ad2…91c4</strong><small>配置、Agent、Skill、Plugin 和 MCP 能力目录统一生成内容 Hash。</small></section></div></div><footer><Icon name="shield"/><span>编辑草稿不会改变已经开始的 Run</span></footer></aside>;
}

function ProjectWorkspace({project,onExit,initialStage}:{project:Project;onExit:()=>void;initialStage:StageKey}) {
  const [threads,setThreads]=useState<ThreadRecord[]>(()=>threadsForProject(project));
  const initialThread=initialStage==='overview'?'main':threads.find(item=>item.stage===initialStage&&item.state!=='completed')?.key??'main'; const [threadKey,setThreadKey]=useState<ThreadKey>(initialThread); const [mode,setMode]=useState<WorkspaceMode>('conversation'); const [inspector,setInspector]=useState<InspectorTab>('summary'); const [decision,setDecision]=useState<Decision>('waiting');
  const [messages,setMessages]=useState<Partial<Record<ThreadKey,string[]>>>(()=>{try{return JSON.parse(localStorage.getItem('factory-prototype-thread-messages')??'{}')}catch{return {}}});
  const [leftWidth,setLeftWidth]=useState(272); const [rightWidth,setRightWidth]=useState(360);
  const thread=threads.find(item=>item.key===threadKey)??threads[0];
  useEffect(()=>localStorage.setItem('factory-prototype-thread-messages',JSON.stringify(messages)),[messages]);
  const selectThread=(next:ThreadKey)=>{setThreadKey(next);setMode('conversation');setInspector('summary')};
  const messageKey=`${project.id}:${threadKey}`; const threadMessages=messages[messageKey]??[];
  const send=(message:string)=>setMessages(current=>({...current,[messageKey]:[...(current[messageKey]??[]),message]}));
  const newThread=()=>{const key=`thread-${Date.now()}`;const next:ThreadRecord={key,title:'新的工作会话',stage:'overview',agent:'Factory',state:'active',meta:'刚刚',session:{id:`SES-${project.id}-${threads.length+1}`,run:'尚未创建',title:'新的工作会话',agent:'Factory',time:'刚刚',status:'current',policy:'USER_CREATED',summary:'由操作员创建的持续工作会话。',artifact:'暂无产物'}};setThreads(current=>[current[0],next,...current.slice(1)]);selectThread(key)};
  const renameThread=()=>{const title=window.prompt('重命名会话',thread.title)?.trim();if(title)setThreads(current=>current.map(item=>item.key===thread.key?{...item,title}:item))};
  const archiveThread=()=>{setThreads(current=>current.map(item=>item.key===thread.key?{...item,archived:true}:item));selectThread('main')};
  const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
  const leftStart=leftWidth; const rightStart=rightWidth;
  return <div className="project-workspace resizable-workspace" style={{gridTemplateColumns:`${leftWidth}px 7px minmax(520px,1fr) 7px ${rightWidth}px`}}><ConversationTree project={project} threads={threads} thread={threadKey} mode={mode} onSelect={selectThread} onSettings={()=>setMode('settings')} onNew={newThread} onExit={onExit}/><ColumnResizer label="调整会话栏宽度" onDrag={delta=>setLeftWidth(clamp(leftStart+delta,240,400))} onNudge={delta=>setLeftWidth(value=>clamp(value+delta,240,400))}/>{mode==='settings'?<ProjectSettings project={project}/>:<WorkSurface project={project} threads={threads} thread={thread} decision={decision} setDecision={setDecision} onSend={send} onRename={renameThread} onArchive={archiveThread} messages={threadMessages} onThreadSelect={selectThread}/>}<ColumnResizer label="调整项目状态栏宽度" onDrag={delta=>setRightWidth(clamp(rightStart-delta,320,500))} onNudge={delta=>setRightWidth(value=>clamp(value-delta,320,500))}/>{mode==='settings'?<ConfigInspector project={project}/>:<Inspector project={project} tab={inspector} setTab={setInspector} threads={threads} thread={thread}/>}</div>;
}

function QueueDrawer({onClose}:{onClose:()=>void}) { const rows=[['RUN-2048','统一身份平台','总体设计裁决','等待审核'],['RUN-2049','统一身份平台','CU-03 · 审计日志','被阻塞'],['RUN-2050','运营配置中心','系统集成','排队中']]; return <><button className="drawer-scrim" aria-label="关闭执行队列" onClick={onClose}/><aside className="queue-drawer" aria-label="Factory 执行队列"><header><div><span>全局执行容量</span><h2>执行队列</h2></div><button aria-label="关闭执行队列" onClick={onClose}><Icon name="close"/></button></header><section className="capacity-summary"><span><i/>1 / 1 正在执行</span><strong>RUN-2048</strong><small>单活动执行权 · 等待容量不是失败</small></section>{rows.map(([run,project,scope,status],index)=><button className="queue-row" key={run}><em>{index+1}</em><span><code>{run}</code><strong>{scope}</strong><small>{project}</small></span><i className={index===0?'amber':''}>{status}</i></button>)}<footer>跨项目容量投影；进入项目后按当前阶段查看运行上下文。</footer></aside></>;
}

function ProjectCreate({onClose,onCreate}:{onClose:()=>void;onCreate:(project:Project)=>void}) { const [step,setStep]=useState(1); const [name,setName]=useState('客户服务工作台'); const [template,setTemplate]=useState('Spring Boot + Vue'); const templates=[['Spring Boot + Vue','前后端复合项目 · v1.4.2'],['Node Service','单模块服务 · v2.1.0'],['React Web App','前端应用 · v1.8.3']]; const finish=()=>onCreate({id:'PRJ-025',initials:'CS',name,template,stage:'实例化与验证',status:'initializing',progress:12,updated:'刚刚',root:'D:\\workspace\\customer-service',profile:'受控开发'}); return <><button className="modal-scrim" aria-label="关闭创建项目" onClick={onClose}/><section className="create-modal" role="dialog" aria-label="创建项目"><header><div><span>新建项目</span><h2>创建项目</h2></div><button aria-label="关闭创建项目" onClick={onClose}><Icon name="close"/></button></header><div className="create-steps">{['基本信息','选择模板','确认初始化'].map((label,index)=><div className={step===index+1?'active':step>index+1?'done':''} key={label}><i>{step>index+1?<Icon name="check"/>:index+1}</i><span>{label}</span></div>)}</div><div className="create-body">{step===1&&<><label>项目名称<input value={name} onChange={event=>setName(event.target.value)}/></label><label>工作目录<input defaultValue="D:\\workspace\\customer-service"/></label><div className="form-note"><Icon name="shield"/><p>实例化前会验证目录、Git 状态和初始版本。</p></div></>}{step===2&&<><div className="choice-label">选择已发布模板</div>{templates.map(([option,meta])=><button className={`template-choice ${template===option?'active':''}`} onClick={()=>setTemplate(option)} key={option}><span><strong>{option}</strong><small>{meta}</small></span>{template===option&&<Icon name="check"/>}</button>)}</>}{step===3&&<><div className="review-block"><span>项目</span><strong>{name}</strong><small>PRJ-025 · D:\\workspace\\customer-service</small></div><div className="review-block"><span>模板绑定</span><strong>{template}</strong><small>发布版本将按内容哈希固定</small></div><div className="review-block"><span>OpenCode 默认配置</span><strong>受控开发</strong><small>项目级 Agent、Skills、MCP、Plugins 与权限策略</small></div><div className="validation-list"><span><Icon name="check"/>工作目录可用</span><span><Icon name="check"/>模板合同兼容</span><span><Icon name="check"/>项目配置 Schema 兼容</span><span><Icon name="check"/>可进入执行队列</span></div><div className="form-note amber"><Icon name="warning"/><p>确认后开始实例化；完成编译、测试、启动和停止检查后，仍需人工批准初始化基线。</p></div></>}</div><footer><button className="secondary-action" onClick={step===1?onClose:()=>setStep(step-1)}>{step===1?'取消':'上一步'}</button><button className="primary-action" disabled={!name.trim()} onClick={step===3?finish:()=>setStep(step+1)}>{step===3?'开始初始化':'继续'} <Icon name="arrow"/></button></footer></section></>;
}

function App(){ const [view,setView]=useState<AppView>('projects'); const [entryStage,setEntryStage]=useState<StageKey>('overview'); const [projects,setProjects]=useState(initialProjects); const [projectId,setProjectId]=useState('PRJ-024'); const [queueOpen,setQueueOpen]=useState(false); const [createOpen,setCreateOpen]=useState(false); const selectedProject=projects.find(project=>project.id===projectId)??projects[0]; const home=()=>setView('projects'); const openStage=(stage:StageKey,id='PRJ-024')=>{setProjectId(id);setEntryStage(stage);setView('workspace')}; return <div className={`app-shell ${view==='workspace'?'workspace-mode':''}`}><GlobalNav view={view} onNavigate={setView}/><section className="workspace"><Topbar view={view} project={selectedProject} onHome={home} onQueue={()=>setQueueOpen(true)}/>{view==='projects'&&<ProjectsHome projects={projects} onOpen={id=>openStage('overview',id)} onCreate={()=>setCreateOpen(true)}/>} {view==='attention'&&<AttentionView onOpen={stage=>openStage(stage)}/>} {view==='operations'&&<OperationsView onOpen={stage=>openStage(stage)}/>} {view==='workspace'&&<ProjectWorkspace key={`${selectedProject.id}-${entryStage}`} project={selectedProject} initialStage={entryStage} onExit={home}/>}</section>{queueOpen&&<QueueDrawer onClose={()=>setQueueOpen(false)}/>} {createOpen&&<ProjectCreate onClose={()=>setCreateOpen(false)} onCreate={project=>{setProjects([project,...projects]);setCreateOpen(false)}}/>}</div>; }

createRoot(document.getElementById('app')!).render(<App/>);
