(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={diffs:[],fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const preset={name:'ST Sample',temperature:1.15,frequency_penalty:-0.5,presence_penalty:0.3,top_p:0.95,top_k:40,top_a:0.1,min_p:0.05,repetition_penalty:1.1,openai_max_context:200000,openai_max_tokens:8192,max_context_unlocked:true,stream_openai:true,
  names_behavior:-1,send_if_empty:'',impersonation_prompt:'IMP',new_chat_prompt:'NC',new_group_chat_prompt:'NG',new_example_chat_prompt:'NE',continue_nudge_prompt:'CN',bias_preset_selected:'Default (none)',wi_format:'[{0}]',scenario_format:'{{scenario}}',personality_format:'{{personality}}',group_nudge_prompt:'GN',assistant_prefill:'Sure',assistant_impersonation:'',claude_use_sysprompt:true,use_sysprompt:true,squash_system_messages:true,image_inlining:true,inline_image_quality:'high',bypass_status_check:false,continue_prefill:true,continue_postfix:'\n',function_calling:false,show_thoughts:true,reasoning_effort:'min',verbosity:'low',enable_web_search:false,request_images:false,seed:12345,n:2,tool_call_recurse_limit:7,
  media_inlining:true,show_external_models:true,vertexai_region:'us-central1',extensions:{regex_scripts:[{id:'r1',scriptName:'x',findRegex:'/a/g',replaceString:'b'}]},custom_unknown:{keep:'me'},
  prompts:[{identifier:'main',name:'Main Prompt',system_prompt:true,role:'system',content:'Write {{char}} reply',enabled:true,injection_position:0,injection_depth:4,injection_order:100,forbid_overrides:false,injection_trigger:['normal']},{identifier:'chatHistory',name:'Chat History',system_prompt:true,marker:true,role:'system'},{identifier:'u-1',name:'Custom',role:'user',content:'hi',system_prompt:false,injection_position:1,injection_depth:2,injection_order:50,injection_trigger:[],forbid_overrides:true,enabled:false}],
  prompt_order:[{character_id:100000,order:[{identifier:'main',enabled:true},{identifier:'chatHistory',enabled:true},{identifier:'u-1',enabled:false}]},{character_id:100001,order:[{identifier:'main',enabled:true},{identifier:'u-1',enabled:true}]}]};
 const dt=new DataTransfer(); dt.items.add(new File([JSON.stringify(preset)],'st.json')); const inp=document.getElementById('filePresetInput'); inp.files=dt.files; inp.dispatchEvent(new Event('change')); await w(500);
 const id=activePresetId; chk('preset imported & open', !!id&&document.getElementById('psName')?.value==='ST Sample');
 savePreset({silent:true,noHistory:true}); await w(100);
 exportPreset(); const ex=JSON.parse((await dl()).text);
 const keys=new Set([...Object.keys(preset),...Object.keys(ex)]);
 for(const k of keys){ const a=JSON.stringify(preset[k]), b=JSON.stringify(ex[k]); if(a!==b) out.diffs.push(k+': '+(a||'').slice(0,90)+'  ->  '+(b||'').slice(0,90)); }
 return out;
})()
