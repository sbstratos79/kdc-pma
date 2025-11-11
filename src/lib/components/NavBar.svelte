<script>
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';
</script>

<Navbar>
	<NavBrand href="/">
		<span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white">Flowbite</span
		>
	</NavBrand>
	<NavHamburger />
	<NavUl>
		<span class="nowrap flex flex-row gap-2 text-lg">
			<NavLi href="/">Pending Tasks</NavLi>
			<NavLi href="/architect-project-tasks">Architect Project Tasks</NavLi>
			<NavLi href="/architect-projects">Architect Projects</NavLi>
			<NavLi href="/studio">Studio</NavLi>
			<NavLi href="/studio-projects">Studio Projects</NavLi>
			<NavLi href="/projects">Projects</NavLi>
			<NavLi href="/tasks-editor">Tasks Editor</NavLi>
			<NavLi href="/projects-editor">Projects Editor</NavLi>
			<NavLi href="/architects-editor">Architects Editor</NavLi>
		</span>
	</NavUl>
</Navbar>
