<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  let age = $state('');
  let sex = $state('');

  const ageOptions = [
    { value: '18-24', label: '18-24' },
    { value: '25-34', label: '25-34' },
    { value: '35-44', label: '35-44' },
    { value: '45-54', label: '45-54' },
    { value: '55-64', label: '55-64' },
    { value: '65+', label: '65+' }
  ];

  const sexOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'neither', label: 'Neither' }
  ];

  function handleSubmit() {
    // Get all responses from localStorage
    const userVotes = JSON.parse(localStorage.getItem('userVotes') || '{}');
    const answeredQuestions = JSON.parse(localStorage.getItem('answeredQuestions') || '[]');
    
    // Create a complete response object with null values for missing demographic data
    const responseData = {
      demographics: {
        age: age || null,
        sex: sex || null
      },
      responses: userVotes,
      answeredQuestions
    };

    // Save to localStorage
    localStorage.setItem('completeResponseData', JSON.stringify(responseData));
    
    // Dispatch event to parent
    dispatch('complete', responseData);
  }
</script>

<div class="demographic-survey">
  <h2>Almost done! Please tell us a bit about yourself</h2>
  
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
      <label for="age">What is your age? (optional)</label>
      <select 
        id="age" 
        bind:value={age}
      >
        <option value="">Select age range</option>
        {#each ageOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <div class="form-group">
      <label for="sex">What is your sex? (optional)</label>
      <select 
        id="sex" 
        bind:value={sex}
      >
        <option value="">Select sex</option>
        {#each sexOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <button type="submit">
      Submit
    </button>
  </form>
</div>

<style>
  .demographic-survey {
    max-width: 600px;
    margin: 2rem auto;
    padding: 2rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  h2 {
    text-align: center;
    color: #333;
    margin-bottom: 2rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    color: #555;
    font-weight: 500;
  }

  select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    color: #333;
    background: white;
  }

  select:focus {
    outline: none;
    border-color: #4a90e2;
  }

  button {
    width: 100%;
    padding: 1rem;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  button:hover {
    background: #357abd;
  }
</style> 