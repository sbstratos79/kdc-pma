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
			<NavLi href="/tasks">Tasks</NavLi>
			<NavLi href="/subtasks">Subtasks</NavLi>
		</span>
	</NavUl>
</Navbar>
