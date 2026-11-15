import assert from 'node:assert/strict';
import {createRecord,selectTopEvidence,sourceVerified,buildOutreach} from './engine.mjs';
const failing=[];
function check(name,fn){try{fn();console.log('PASS',name)}catch(e){failing.push(name);console.log('FAIL',name,':',e.message)}}
check('blank new drafts must be unique',()=>assert.notEqual(createRecord({}).id,createRecord({}).id));
check('insufficient offer must not select unrelated CV evidence',()=>assert.deepEqual(selectTopEvidence({selected:[],coverage:null,state:'insufficient'},[{id:'cv:a'}]),[]));
check('automatically published official contact may be used with its source',()=>assert.equal(sourceVerified({email:'jobs@example.com',status:'published',sourceUrl:'https://example.com/careers'}),true));
check('custom relevance note appears in cold email',()=>assert.ok(buildOutreach({offer:{title:'Creative Director',company:'A'},relevanceLine:'Visual leadership of the brand launch'}).body.includes('Visual leadership of the brand launch')));
console.log(`${failing.length} regressions found`);

if(failing.length)process.exitCode=1;