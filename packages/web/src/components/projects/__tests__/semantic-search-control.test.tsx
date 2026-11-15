import React from 'react'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import {TwoEntryProjectHub} from '../TwoEntryProjectHub'
import {SemanticSearchControl} from '../SemanticSearchControl'
const readiness=jest.fn()
jest.mock('@/lib/semantic-search-client',()=>({readSemanticReadiness:(...args:unknown[])=>readiness(...args)}))
const config={ready:true,provider:'voyage',region:'us',policyVersion:'a'.repeat(64)}
beforeEach(()=>{readiness.mockReset();readiness.mockResolvedValue(config)})
it('mounts explicit semantic consent and passes mode/query/current policy through real hub',async()=>{
 const search=jest.fn().mockResolvedValue({status:'no_matching_sources',citations:[],answerText:'No current sources.'})
 render(<TwoEntryProjectHub projectId="project" projectName="Family" onSearch={search}/>)
 const button=await screen.findByRole('button',{name:'Search by meaning'});expect(button).toBeDisabled()
 fireEvent.change(screen.getByRole('textbox',{name:'Search query'}),{target:{value:'relocation'}});expect(button).toBeDisabled()
 fireEvent.click(screen.getByRole('checkbox'));expect(button).toBeEnabled();fireEvent.click(button)
 await waitFor(()=>expect(search).toHaveBeenCalledWith({query:'relocation',mode:'semantic',consent:true,policyVersion:config.policyVersion,person:undefined,date:undefined,place:undefined}))
 expect(screen.getByRole('checkbox')).not.toBeChecked()
})
it('shows unavailable state while literal search remains usable',async()=>{
 readiness.mockResolvedValue({...config,ready:false,policyVersion:null})
 render(<TwoEntryProjectHub projectId="project" projectName="Family" onSearch={jest.fn()}/>);await screen.findByText(/Semantic search is unavailable/)
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Search Archive'})).toBeEnabled()
})
it('drops stale configuration and consent when project changes',async()=>{
 const view=render(<SemanticSearchControl projectId="one" hasQuery busy={false} onSearch={jest.fn()}/>);await screen.findByRole('checkbox');fireEvent.click(screen.getByRole('checkbox'))
 view.rerender(<SemanticSearchControl projectId="two" hasQuery busy={false} onSearch={jest.fn()}/>);await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeChecked())
 expect(readiness).toHaveBeenLastCalledWith('two',expect.any(AbortSignal))
})
